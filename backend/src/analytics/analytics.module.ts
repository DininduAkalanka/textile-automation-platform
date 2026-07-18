import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  // AiModule provides AiService for the predictive-analytics proxy routes.
  imports: [PrismaModule, AiModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  // Exported so the Phase 9 AI gateway can call the same pure aggregates
  // rather than reimplementing them (decision D9).
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
