import { IsEnum, IsNumberString, Length } from 'class-validator';
import { VerificationChannel } from '@prisma/client';

export class VerifyCodeDto {
  @IsEnum(VerificationChannel)
  channel: VerificationChannel;

  @IsNumberString()
  @Length(6, 6)
  code: string;
}
