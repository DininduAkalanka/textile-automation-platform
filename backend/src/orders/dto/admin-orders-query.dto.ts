import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminOrdersQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  /** Filters on the ORDER's payment row, not the order's own status. */
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  /** Inclusive start of the placed-date range. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Inclusive end of the placed-date range. */
  @IsOptional()
  @IsISO8601()
  to?: string;

  /** Matches order number, customer name, or customer email — case-insensitive. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
