import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  IsNumber,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  /**
   * BR3 measurements for this line (doc 01 §7).
   *
   * Shape: { personName, label?, values: { chest: 96, ... } }. Typed loosely
   * here because the required field set depends on the PRODUCT's type, which is
   * only known once the product is loaded from the database. The real check runs
   * in OrdersService.create via validateMeasurements(), against the product row
   * rather than anything the client claims — so a client cannot dodge BR3 by
   * mislabelling a uniform.
   */
  @IsOptional()
  @IsObject()
  measurements?: Record<string, unknown>;
}

export class AddressDto {
  @IsString()
  fullName: string;

  @IsString()
  addressLine1: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  postalCode: string;

  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateOrderDto {
  @IsArray()
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

  @IsOptional()
  @IsString()
  notes?: string;
}
