import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  // Prisma is here for the FALLBACK search only — the AI service reads the
  // catalogue itself, through a read-only role that cannot see users or orders.
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
