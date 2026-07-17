import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { IsLkPhone } from '../../common/phone.util';

/**
 * Both email and phone are optional at the DTO layer (an account may be
 * email-only OR phone-only). The "at least one contact" rule is enforced in
 * AuthService.register, co-located with the duplicate-contact check — the DTO
 * only validates FORMAT.
 */
export class RegisterDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName: string;

  @IsOptional()
  @IsLkPhone()
  phone?: string;
}
