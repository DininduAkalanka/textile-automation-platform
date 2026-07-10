import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
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
}
