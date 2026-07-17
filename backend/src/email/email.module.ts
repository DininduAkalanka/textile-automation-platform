import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

// ConfigModule is global (app.module.ts), so no imports are needed here.
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
