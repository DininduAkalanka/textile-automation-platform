import { ProductType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

const SORTABLE = ['name', 'price', 'stockQuantity', 'updatedAt'] as const;
type SortableField = (typeof SORTABLE)[number];

export class AdminProductsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Matches name, SKU or description — case-insensitive. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType;

  /**
   * The whole reason this endpoint exists rather than reusing the public
   * GET /products: that one hardcodes `isActive: true` so a shopper never sees
   * an archived product, which is correct for a storefront and wrong for an
   * admin table that needs to find, filter, and restore exactly those rows.
   * Omitted = active products only. Same `enableImplicitConversion` boolean trap as
   * inventory's lowStockOnly (the STRING "false" is truthy under `!!value`),
   * so the RAW query string (obj[key]) is read — `value` has already been coerced.
   */
  @IsOptional()
  @Transform(({ obj, key }) => obj[key] === true || obj[key] === 'true')
  @IsBoolean()
  archivedOnly?: boolean;

  /** available (available - reserved) at or below the product's own reorder
   *  minimum — the same definition inventory.service.ts's list() uses. */
  @IsOptional()
  @Transform(({ obj, key }) => obj[key] === true || obj[key] === 'true')
  @IsBoolean()
  lowStockOnly?: boolean;

  @IsOptional()
  @IsIn(SORTABLE)
  sortBy?: SortableField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
