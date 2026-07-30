import { Module } from '@nestjs/common';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationDispatchService } from './notification-dispatch.service';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { InvoiceModule } from '../invoices/invoice.module';

// NotificationsService = in-app rows (bell icon), read side only.
// NotificationDispatchService = outbound email/SMS, sent post-commit by
// OrdersService/PaymentsService — hence the export.
@Module({
  imports: [EmailModule, SmsModule, InvoiceModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationDispatchService],
  exports: [NotificationDispatchService],
})
export class NotificationsModule {}
