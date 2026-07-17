import { IsEnum } from 'class-validator';
import { VerificationChannel } from '@prisma/client';

export class SendCodeDto {
  @IsEnum(VerificationChannel)
  channel: VerificationChannel;
}
