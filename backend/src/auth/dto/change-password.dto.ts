import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/** Same password rules as registration and password reset. */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  newPassword: string;
}
