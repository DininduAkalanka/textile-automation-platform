import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, ReviewStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

export type ReviewEligibility =
  | { eligible: true; orderId: string }
  | { eligible: false; reason: 'NOT_PURCHASED' }
  | { eligible: false; reason: 'NOT_DELIVERED' }
  | { eligible: false; reason: 'ALREADY_REVIEWED'; reviewId: string };

const REVIEW_USER_SELECT = {
  select: { id: true, firstName: true, lastName: true },
} as const;

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  // ─── Eligibility (drives the frontend CTA) ──────────────

  /**
   * Never the source of truth for write access — create() re-derives this
   * independently. This exists purely to tell the UI which of the three
   * "Write a Review" states to show, and which orderId to submit with.
   */
  async checkEligibility(
    userId: string,
    productId: string,
  ): Promise<ReviewEligibility> {
    const deliveredOrders = await this.prisma.order.findMany({
      where: {
        userId,
        status: OrderStatus.DELIVERED,
        items: { some: { productId } },
      },
      select: { id: true },
      orderBy: { updatedAt: 'asc' },
    });

    if (deliveredOrders.length === 0) {
      const everPurchased = await this.prisma.order.findFirst({
        where: { userId, items: { some: { productId } } },
        select: { id: true },
      });
      return {
        eligible: false,
        reason: everPurchased ? 'NOT_DELIVERED' : 'NOT_PURCHASED',
      };
    }

    const existingReviews = await this.prisma.review.findMany({
      where: {
        userId,
        productId,
        orderId: { in: deliveredOrders.map((o) => o.id) },
      },
      select: { id: true, orderId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const reviewedOrderIds = new Set(existingReviews.map((r) => r.orderId));

    const nextOrder = deliveredOrders.find((o) => !reviewedOrderIds.has(o.id));
    if (nextOrder) {
      return { eligible: true, orderId: nextOrder.id };
    }

    // Every delivered order for this product already has a review — surface
    // the most recent one so the UI can offer "edit your review" instead.
    return {
      eligible: false,
      reason: 'ALREADY_REVIEWED',
      reviewId: existingReviews[0].id,
    };
  }

  // ─── Create / Update ─────────────────────────────────────

  /**
   * Server-side re-verification of everything the frontend's eligibility
   * check already told it — never trust dto.orderId/productId on their own.
   * The order must belong to this user, contain this product, and be
   * DELIVERED. The @@unique([orderId, productId, userId]) constraint is the
   * final backstop against a duplicate-submit race.
   */
  async create(userId: string, dto: CreateReviewDto) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: dto.orderId,
        userId,
        status: OrderStatus.DELIVERED,
        items: { some: { productId: dto.productId } },
      },
      select: { id: true },
    });
    if (!order) {
      throw new BadRequestException(
        'This order does not qualify for a review on this product — it must be yours, contain this product, and be delivered.',
      );
    }

    try {
      return await this.prisma.review.create({
        data: {
          productId: dto.productId,
          orderId: dto.orderId,
          userId,
          rating: dto.rating,
          title: dto.title,
          comment: dto.comment,
          fabricRating: dto.fabricRating,
          colorAccuracyRating: dto.colorAccuracyRating,
          comfortRating: dto.comfortRating,
          sizeFeedback: dto.sizeFeedback,
          wouldRecommend: dto.wouldRecommend,
          images: dto.images ?? [],
          hasImages: (dto.images?.length ?? 0) > 0,
          isVerifiedPurchase: true,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          'You have already reviewed this product for this order.',
        );
      }
      throw e;
    }
  }

  async update(reviewId: string, userId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    if (review.userId !== userId) {
      throw new ForbiddenException('You can only edit your own review');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...dto,
        ...(dto.images !== undefined
          ? { hasImages: dto.images.length > 0 }
          : {}),
      },
    });
  }

  // ─── Public listing + aggregate stats ───────────────────

  async findForProduct(productId: string, query: ReviewQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      productId,
      status: ReviewStatus.PUBLISHED,
    };
    if (query.rating) where.rating = query.rating;
    if (query.hasPhotos) where.hasImages = true;
    if (query.verifiedOnly) where.isVerifiedPurchase = true;

    const orderBy: Prisma.ReviewOrderByWithRelationInput =
      query.sortBy === 'highest'
        ? { rating: 'desc' }
        : query.sortBy === 'lowest'
          ? { rating: 'asc' }
          : query.sortBy === 'helpful'
            ? { helpfulCount: 'desc' }
            : { createdAt: 'desc' };

    // Stats (average/distribution/total) always describe every PUBLISHED
    // review for the product, independent of the list's own filters — the
    // summary block never shrinks just because the visitor filtered the list
    // below it, matching the referenced platforms' behavior.
    const statsWhere: Prisma.ReviewWhereInput = {
      productId,
      status: ReviewStatus.PUBLISHED,
    };

    const [reviews, total, ratingGroups, avgAgg] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { user: REVIEW_USER_SELECT },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: statsWhere,
        _count: { rating: true },
      }),
      this.prisma.review.aggregate({
        where: statsWhere,
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const group of ratingGroups) {
      distribution[group.rating as 1 | 2 | 3 | 4 | 5] = group._count.rating;
    }

    return {
      reviews,
      stats: {
        average: avgAgg._avg.rating ? Number(avgAgg._avg.rating.toFixed(2)) : 0,
        total: avgAgg._count.rating,
        distribution,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ─── Helpful votes ───────────────────────────────────────

  async toggleHelpful(reviewId: string, userId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const existingVote = await this.prisma.reviewHelpfulVote.findUnique({
      where: { reviewId_userId: { reviewId, userId } },
    });

    const [, updated] = await this.prisma.$transaction([
      existingVote
        ? this.prisma.reviewHelpfulVote.delete({
            where: { id: existingVote.id },
          })
        : this.prisma.reviewHelpfulVote.create({ data: { reviewId, userId } }),
      this.prisma.review.update({
        where: { id: reviewId },
        data: {
          helpfulCount: { [existingVote ? 'decrement' : 'increment']: 1 },
        },
      }),
    ]);

    return { helpful: !existingVote, helpfulCount: updated.helpfulCount };
  }

  // ─── Reports ─────────────────────────────────────────────

  async report(reviewId: string, userId: string, dto: ReportReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    await this.prisma.reviewReport.create({
      data: { reviewId, userId, reason: dto.reason },
    });
    return { reported: true };
  }

  // ─── Admin moderation ────────────────────────────────────

  async adminFindAll(filters: {
    status?: ReviewStatus;
    reportedOnly?: boolean;
    productId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.productId) where.productId = filters.productId;
    if (filters.reportedOnly) where.reports = { some: {} };
    if (filters.search) {
      where.product = {
        name: { contains: filters.search, mode: 'insensitive' },
      };
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: { id: true, name: true, slug: true, images: true },
          },
          user: REVIEW_USER_SELECT,
          _count: { select: { reports: true } },
          reports: {
            select: { id: true, reason: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async hide(id: string) {
    await this.assertExists(id);
    return this.prisma.review.update({
      where: { id },
      data: { status: ReviewStatus.HIDDEN },
    });
  }

  async unhide(id: string) {
    await this.assertExists(id);
    return this.prisma.review.update({
      where: { id },
      data: { status: ReviewStatus.PUBLISHED },
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.review.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async assertExists(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
  }
}
