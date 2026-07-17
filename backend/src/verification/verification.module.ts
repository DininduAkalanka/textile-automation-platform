import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { VerificationService } from './verification.service';

// PrismaModule is global; Email/Sms are imported directly for their services.
@Module({
  imports: [EmailModule, SmsModule],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
