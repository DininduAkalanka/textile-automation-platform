import { Module } from '@nestjs/common';

import { UploadCleanupService } from './upload-cleanup.service';
import {
  ReviewUploadQuotaGuard,
  ReviewUploadsController,
  UploadsController,
} from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController, ReviewUploadsController],
  providers: [UploadsService, UploadCleanupService, ReviewUploadQuotaGuard],
  exports: [UploadsService],
})
export class UploadsModule {}
