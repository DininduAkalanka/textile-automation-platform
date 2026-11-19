import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  IsInt,
  Max,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MAX_LINES_PER_ORDER_AT_LOAD,
  MAX_QTY_PER_LINE_AT_LOAD,
} from '../../common/config/limits';

export class OrderItemDto {
  @IsUUID()
  productId: string;

  // QA P0-2: one anonymous request could reserve a product's entire stock
  // (quantity 30 took a product from 30 sellable to 0). A per-line cap bounds
  // what any single order can hold; bulk orders go through the shop.
  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1)
  @Max(MAX_QTY_PER_LINE_AT_LOAD, {
    message: `Quantity per item cannot exceed ${MAX_QTY_PER_LINE_AT_LOAD}. Contact the shop for bulk orders.`,
  })
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

  /**
   * Chosen product variant attributes such as size (e.g. { size: 'M' }).
   * Snapshotted onto the order_items row in database.
   */
  @IsOptional()
  @IsObject()
  selectedAttributes?: Record<string, unknown>;
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
  // QA P2-1: an empty cart created a Rs 0 order that COD then "confirmed".
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

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
