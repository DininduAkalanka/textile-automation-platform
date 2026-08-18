import { Module } from '@nestjs/common';

import {
  ReviewUploadsController,
  UploadsController,
} from './uploads.controller';

@Module({
  controllers: [UploadsController, ReviewUploadsController],
})
export class UploadsModule {}
