import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  identifier: string;
}

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[0-9a-f]{64}$/, { message: 'Open the reset link from your message.' })
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;
}
