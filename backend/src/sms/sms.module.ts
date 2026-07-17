import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';

// ConfigModule is global (app.module.ts), so no imports are needed here.
@Module({
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
