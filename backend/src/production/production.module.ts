import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProductionController],
  providers: [ProductionService],
  // OrdersModule imports this to fire the ProductionTrigger on confirmation
  // (decision D8) inside the same transaction that deducts stock.
  exports: [ProductionService],
})
export class ProductionModule {}
