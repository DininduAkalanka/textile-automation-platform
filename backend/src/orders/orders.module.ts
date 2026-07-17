import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductionModule } from '../production/production.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  // ProductionModule provides the ProductionTrigger that confirmOrder fires on
  // CONFIRMED (decision D8). NotificationsModule provides the post-commit
  // email/SMS dispatcher (order-confirmation invoice).
  imports: [InventoryModule, ProductionModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
