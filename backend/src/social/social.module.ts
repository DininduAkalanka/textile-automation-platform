import { Module } from '@nestjs/common';

import { CaptionService } from './caption.service';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

/**
 * Marketing automation: generate a caption for a product and (optionally) post
 * it to Facebook/Instagram via the Meta Graph API. PrismaModule and ConfigModule
 * are global, so nothing extra to import here.
 */
@Module({
  controllers: [SocialController],
  providers: [SocialService, CaptionService],
  exports: [SocialService, CaptionService],
})
export class SocialModule {}
