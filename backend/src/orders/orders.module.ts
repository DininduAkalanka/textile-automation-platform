import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductionModule } from '../production/production.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvoiceModule } from '../invoices/invoice.module';

import { AuthModule } from '../auth/auth.module';
import { VerificationModule } from '../verification/verification.module';

@Module({
  // ProductionModule provides the ProductionTrigger that confirmOrder fires on
  // CONFIRMED (decision D8). NotificationsModule provides the post-commit
  // email/SMS dispatcher (order-confirmation invoice). InvoiceModule backs the
  // GET /orders/:id/invoice.pdf download route.
  imports: [
    InventoryModule,
    ProductionModule,
    NotificationsModule,
    InvoiceModule,
    AuthModule,
    VerificationModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
