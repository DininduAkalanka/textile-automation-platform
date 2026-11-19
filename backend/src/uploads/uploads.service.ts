import { unlink } from 'fs/promises';
import { join } from 'path';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UploadPurpose } from '@prisma/client';

import {
  publicUploadUrl,
  uploadedFilenameFrom,
} from '../common/config/exposure';
import {
  orphanUploadTtlHours,
  reviewUploadsPerDay,
} from '../common/config/limits';
import { PrismaService } from '../prisma/prisma.service';

export const UPLOAD_DIR = join(process.cwd(), 'uploads');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The bookkeeping behind image uploads (QA P2-15).
 *
 * Before this, an upload was just a file on disk: any signed-in customer could
 * upload without limit, and a review could carry ANY URL as a "photo" — another
 * customer's upload, or an image on an outside site. Every upload is now
 * recorded with its uploader, which is what the quota, the ownership check on
 * review photos and the orphan cleanup below are built on.
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  record(
    file: { filename: string; size: number },
    uploadedById: string | null,
    purpose: UploadPurpose,
  ) {
    return this.prisma.uploadedImage.create({
      data: {
        filename: file.filename,
        sizeBytes: file.size,
        uploadedById,
        purpose,
      },
    });
  }

  /** Review photos this customer may still upload in the current 24 hours. */
  async reviewUploadsRemaining(userId: string): Promise<number> {
    const used = await this.prisma.uploadedImage.count({
      where: {
        uploadedById: userId,
        purpose: UploadPurpose.REVIEW,
        createdAt: { gte: new Date(Date.now() - DAY_MS) },
      },
    });
    return Math.max(0, reviewUploadsPerDay() - used);
  }

  /**
   * The photos a review may carry, in canonical form.
   *
   * Each must be an image this shop's upload endpoint issued AND that the
   * reviewer uploaded themself. Whatever origin the client sent, the stored URL
   * is rebuilt on the shop's own upload origin, so a review can never point
   * customers at an outside server. A URL already on the review being edited
   * passes through unchanged, so reviews written before this check stay
   * editable.
   */
  async resolveReviewImages(
    userId: string,
    urls: string[],
    alreadyOnReview: string[] = [],
  ): Promise<{ urls: string[]; filenames: string[] }> {
    const kept = new Set(alreadyOnReview);
    const result: string[] = [];
    const filenames: string[] = [];

    for (const url of urls) {
      if (kept.has(url)) {
        if (!result.includes(url)) result.push(url);
        continue;
      }
      const name = uploadedFilenameFrom(url);
      if (!name) {
        throw new BadRequestException({
          message: 'Review photos must be uploaded through the shop.',
          code: 'INVALID_REVIEW_IMAGE',
        });
      }
      if (!filenames.includes(name)) filenames.push(name);
    }

    if (filenames.length > 0) {
      const owned = await this.prisma.uploadedImage.findMany({
        where: {
          filename: { in: filenames },
          uploadedById: userId,
          purpose: UploadPurpose.REVIEW,
        },
        select: { filename: true },
      });
      if (owned.length !== filenames.length) {
        throw new BadRequestException({
          message:
            'Only photos you uploaded yourself can be added to your review.',
          code: 'INVALID_REVIEW_IMAGE',
        });
      }
    }

    for (const name of filenames) {
      const url = publicUploadUrl(name);
      if (!result.includes(url)) result.push(url);
    }
    return { urls: result, filenames };
  }

  /** Marks photos as in use, so the orphan cleanup never removes them. */
  async markAttached(filenames: string[]): Promise<void> {
    if (filenames.length === 0) return;
    await this.prisma.uploadedImage.updateMany({
      where: { filename: { in: filenames }, attachedAt: null },
      data: { attachedAt: new Date() },
    });
  }

  /**
   * Deletes review photos that were uploaded but never attached to a review
   * within ORPHAN_UPLOAD_TTL_HOURS. A photo that any review still references
   * is never deleted, even if it was not marked attached.
   * Catalogue (admin) uploads are never touched.
   */
  async removeOrphanReviewUploads(batch = 200): Promise<number> {
    // created_at is a UTC wall-clock TIMESTAMP (Prisma's convention), so the
    // cutoff is computed in SQL on the same basis rather than passed in.
    const orphans = await this.prisma.$queryRaw<
      { id: string; filename: string }[]
    >`
      SELECT u.id, u.filename
      FROM uploaded_images u
      WHERE u.purpose = 'REVIEW'
        AND u.attached_at IS NULL
        AND u.created_at < (now() AT TIME ZONE 'UTC')
                           - make_interval(hours => ${orphanUploadTtlHours()}::int)
        AND NOT EXISTS (
          SELECT 1 FROM product_reviews r
          WHERE r.images::text LIKE '%' || u.filename || '%'
        )
      ORDER BY u.created_at
      LIMIT ${batch}
    `;

    let removed = 0;
    for (const orphan of orphans) {
      try {
        await unlink(join(UPLOAD_DIR, orphan.filename));
      } catch (err) {
        // Already gone (e.g. an ephemeral disk was wiped) — still drop the row.
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          this.logger.warn(
            `Could not delete orphan upload ${orphan.filename}: ${(err as Error).message}`,
          );
          continue;
        }
      }
      await this.prisma.uploadedImage.delete({ where: { id: orphan.id } });
      removed++;
    }
    return removed;
  }
}
