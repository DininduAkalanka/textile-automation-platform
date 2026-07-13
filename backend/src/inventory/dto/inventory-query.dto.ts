import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class InventoryQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Matches product name or SKU, case-insensitively. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /**
   * The global ValidationPipe runs with `enableImplicitConversion`, and that
   * coerces booleans with `!!value` — under which the STRING "false" is truthy
   * and `?lowStockOnly=false` would filter to low stock only. That is the exact
   * opposite of what the caller asked for, and it would fail silently.
   *
   * So the flag is parsed explicitly here: only a literal "true" means true.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  lowStockOnly?: boolean;
}

export class MovementsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SetMinimumDto {
  /** The reorder threshold. Stock at or below this is reported as LOW. */
  @IsInt()
  @Min(0)
  @Max(100_000)
  minimum!: number;
}
