import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, ReviewStatus } from '@prisma/client';

import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Reviews are gated on delivery and re-verified server-side on every write —
 * these tests cover the eligibility state machine, the duplicate-review
 * defenses (both the pre-check and the unique-constraint backstop), and the
 * status/ownership guards, mirroring the depth of payments.service.spec.ts.
 */
describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: {
    order: { findMany: jest.Mock; findFirst: jest.Mock };
    review: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
      aggregate: jest.Mock;
    };
    reviewHelpfulVote: { findUnique: jest.Mock; create: jest.Mock; delete: jest.Mock };
    reviewReport: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      order: { findMany: jest.fn(), findFirst: jest.fn() },
      review: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      reviewHelpfulVote: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
      reviewReport: { create: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ReviewsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ReviewsService);
  });

  describe('checkEligibility', () => {
    it('is NOT_PURCHASED when the customer never bought the product', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(service.checkEligibility('u1', 'p1')).resolves.toEqual({
        eligible: false,
        reason: 'NOT_PURCHASED',
      });
    });

    it('is NOT_DELIVERED when purchased but not yet delivered', async () => {
      prisma.order.findMany.mockResolvedValue([]); // no DELIVERED orders
      prisma.order.findFirst.mockResolvedValue({ id: 'o1' }); // but some order exists

      await expect(service.checkEligibility('u1', 'p1')).resolves.toEqual({
        eligible: false,
        reason: 'NOT_DELIVERED',
      });
    });

    it('is eligible on a delivered order with no existing review', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'o1' }]);
      prisma.review.findMany.mockResolvedValue([]);

      await expect(service.checkEligibility('u1', 'p1')).resolves.toEqual({
        eligible: true,
        orderId: 'o1',
      });
    });

    it('is ALREADY_REVIEWED when every delivered order already has a review', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'o1' }]);
      prisma.review.findMany.mockResolvedValue([
        { id: 'rev1', orderId: 'o1', createdAt: new Date() },
      ]);

      await expect(service.checkEligibility('u1', 'p1')).resolves.toEqual({
        eligible: false,
        reason: 'ALREADY_REVIEWED',
        reviewId: 'rev1',
      });
    });

    it('picks a second delivered order (repurchase) that has no review yet', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'o1' }, { id: 'o2' }]);
      prisma.review.findMany.mockResolvedValue([
        { id: 'rev1', orderId: 'o1', createdAt: new Date() },
      ]);

      await expect(service.checkEligibility('u1', 'p1')).resolves.toEqual({
        eligible: true,
        orderId: 'o2',
      });
    });
  });

  describe('create', () => {
    const dto = {
      productId: 'p1',
      orderId: 'o1',
      rating: 5,
      title: 'Great fit',
      comment: 'Loved the fabric and stitching quality overall.',
      fabricRating: 5,
      colorAccuracyRating: 4,
      comfortRating: 5,
      sizeFeedback: 'TRUE_TO_SIZE' as const,
      wouldRecommend: true,
      images: ['https://cdn/img1.jpg'],
    };

    it('rejects when the order does not belong to the user / is not delivered / lacks the product', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(service.create('u1', dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    it('creates a verified review for an eligible delivered order', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'o1' });
      prisma.review.create.mockResolvedValue({ id: 'rev1', ...dto });

      const result = await service.create('u1', dto);

      expect(prisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'o1',
            userId: 'u1',
            status: OrderStatus.DELIVERED,
          }),
        }),
      );
      expect(prisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isVerifiedPurchase: true,
            hasImages: true,
          }),
        }),
      );
      expect(result).toEqual(expect.objectContaining({ id: 'rev1' }));
    });

    it('turns a duplicate-submit race (unique constraint) into a friendly 400, not a 500', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'o1' });
      prisma.review.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );

      await expect(service.create('u1', dto)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('refuses to edit another customer\'s review', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'rev1', userId: 'owner' });

      await expect(
        service.update('rev1', 'attacker', { title: 'edited' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.review.update).not.toHaveBeenCalled();
    });

    it('404s for a review that does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', 'u1', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findForProduct', () => {
    it('only ever queries PUBLISHED reviews for the list and the stats', async () => {
      prisma.review.findMany.mockResolvedValue([]);
      prisma.review.count.mockResolvedValue(0);
      prisma.review.groupBy.mockResolvedValue([]);
      prisma.review.aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } });

      await service.findForProduct('p1', {});

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ productId: 'p1', status: ReviewStatus.PUBLISHED }),
        }),
      );
      expect(prisma.review.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'p1', status: ReviewStatus.PUBLISHED },
        }),
      );
    });
  });

  describe('toggleHelpful', () => {
    it('404s when the review does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.toggleHelpful('missing', 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('adds a vote and increments the count when none exists yet', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'rev1', helpfulCount: 0 });
      prisma.reviewHelpfulVote.findUnique.mockResolvedValue(null);
      prisma.reviewHelpfulVote.create.mockResolvedValue({ id: 'vote1' });
      prisma.review.update.mockResolvedValue({ id: 'rev1', helpfulCount: 1 });

      await expect(service.toggleHelpful('rev1', 'u1')).resolves.toEqual({
        helpful: true,
        helpfulCount: 1,
      });
    });

    it('removes an existing vote and decrements the count', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'rev1', helpfulCount: 1 });
      prisma.reviewHelpfulVote.findUnique.mockResolvedValue({ id: 'vote1' });
      prisma.reviewHelpfulVote.delete.mockResolvedValue({ id: 'vote1' });
      prisma.review.update.mockResolvedValue({ id: 'rev1', helpfulCount: 0 });

      await expect(service.toggleHelpful('rev1', 'u1')).resolves.toEqual({
        helpful: false,
        helpfulCount: 0,
      });
    });
  });
});
