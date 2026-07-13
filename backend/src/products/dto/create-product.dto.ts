import { ProductType } from '@prisma/client';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  IsEnum,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  compareAtPrice?: number;

  @IsNumber()
  @Min(0)
  stockQuantity: number;

  @IsString()
  @MinLength(1)
  sku: string;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsObject()
  @IsOptional()
  attributes?: Record<string, any>;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  /**
   * Drives BR3 (measurement requirements) and D8 (which items enter the
   * production pipeline — production.service.ts's PRODUCTION_TYPES checks
   * exactly this field). Omitting it from this DTO — as it was until now —
   * meant a product created through the admin UI could never be a uniform or
   * custom build no matter what the form said, because the value the admin
   * chose had nowhere to go.
   */
  @IsEnum(ProductType)
  @IsOptional()
  productType?: ProductType;

  @IsBoolean()
  @IsOptional()
  requiresMeasurement?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  fabricType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  color?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  unit?: string;

  /**
   * Deliberately nullable, never defaulted to 0 — see the schema's own
   * comment: a missing cost is unknown margin, and 0 would silently report
   * 100% profit in the analytics profit-by-product tool. Left unset here
   * means left unset in the database, not coerced to a number.
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  costPrice?: number;
}
