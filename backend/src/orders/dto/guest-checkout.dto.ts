import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod, VerificationChannel } from '@prisma/client';
import { AddressDto, OrderItemDto } from './create-order.dto';
import { IsLkPhone } from '../../common/phone.util';
import { MAX_LINES_PER_ORDER_AT_LOAD } from '../../common/config/limits';

export class GuestCheckoutDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'An order needs at least one item' })
  @ArrayMaxSize(MAX_LINES_PER_ORDER_AT_LOAD)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress?: AddressDto;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  email: string;

  // QA P0-2: the phone was any non-empty string ("x" worked). It is now a real
  // Sri Lankan mobile, normalized before it is stored.
  @IsLkPhone()
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  /** The code from POST /orders/guest-checkout/send-code (required for COD). */
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'verificationCode must be 6 digits' })
  verificationCode?: string;

  /** Which contact that code was sent to. Defaults to EMAIL. */
  @IsOptional()
  @IsEnum(VerificationChannel)
  verificationChannel?: VerificationChannel;

  // Same rule as registration (was 6 here, 8 at register).
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

/** Ask for a one-time code before a guest Cash-on-Delivery order (QA P1-8). */
export class GuestSendCodeDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsLkPhone()
  phone: string;

  @IsOptional()
  @IsEnum(VerificationChannel)
  channel?: VerificationChannel;
}
