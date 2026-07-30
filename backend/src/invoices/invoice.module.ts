import { Module } from '@nestjs/common';

import { InvoiceService } from './invoice.service';

/**
 * PDF invoice generation. PrismaModule and ConfigModule are global, so nothing
 * else to import. Exported for the order-confirmation email (attachment) and
 * the invoice download route.
 */
@Module({
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
