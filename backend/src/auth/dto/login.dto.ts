import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  // Email OR phone. AuthService.login detects which and looks up the right
  // unique column, so a customer can sign in with whichever they registered.
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @MinLength(8)
  password: string;
}
