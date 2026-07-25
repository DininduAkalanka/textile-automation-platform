import { SocialPlatform } from '@prisma/client';
import { ArrayNotEmpty, IsArray, IsEnum } from 'class-validator';

export class ShareDto {
  /** Which platforms to attempt. Bounded to the enum — no free-form strings. */
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(SocialPlatform, { each: true })
  platforms!: SocialPlatform[];
}
