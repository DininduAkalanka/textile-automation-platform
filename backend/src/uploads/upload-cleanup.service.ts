import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';

import {
  orphanUploadTtlHours,
  uploadCleanupEnabled,
  uploadCleanupIntervalMs,
} from '../common/config/limits';
import { UploadsService } from './uploads.service';

/**
 * QA P2-15: review photos are uploaded BEFORE the review is submitted, so a
 * customer who abandons the form (or someone filling the disk on purpose)
 * leaves files nobody will ever see. Every UPLOAD_CLEANUP_INTERVAL_MS (default
 * hourly) this deletes review photos never attached to a review within
 * ORPHAN_UPLOAD_TTL_HOURS (default 24). Same shape as the order expiry sweep.
 */
@Injectable()
export class UploadCleanupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(UploadCleanupService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly uploads: UploadsService) {}

  onApplicationBootstrap() {
    if (!uploadCleanupEnabled()) return;
    this.timer = setInterval(
      () => void this.sweep(),
      uploadCleanupIntervalMs(),
    );
    this.timer.unref();
    this.logger.log(
      `Unattached review photos are removed after ${orphanUploadTtlHours()} h`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One pass. Public so tests (and an operator) can run it on demand. */
  async sweep(): Promise<{ removed: number }> {
    if (this.running) return { removed: 0 };
    this.running = true;
    try {
      const removed = await this.uploads.removeOrphanReviewUploads();
      if (removed > 0) {
        this.logger.log(`Removed ${removed} unattached review photo(s)`);
      }
      return { removed };
    } catch (err) {
      this.logger.error(
        `Upload cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { removed: 0 };
    } finally {
      this.running = false;
    }
  }
}
