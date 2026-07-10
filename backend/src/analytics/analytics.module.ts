import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  // Exported so the Phase 9 AI gateway can call the same pure aggregates
  // rather than reimplementing them (decision D9).
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
