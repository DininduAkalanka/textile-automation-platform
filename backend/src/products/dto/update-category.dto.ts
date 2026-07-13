import {
  IsString,
  IsOptional,
  IsUUID,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  /**
   * Three-state field: omitted = leave the parent alone, null = promote to
   * top-level, a UUID = reparent. `@ValidateIf` lets `null` through without
   * tripping `@IsUUID()`, which `@IsOptional()` alone would not do (that only
   * skips validation when the key is absent, not when it's present-and-null).
   */
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  @IsOptional()
  parentId?: string | null;
}
