import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

import {
  IMAGE_URL_MESSAGE,
  IMAGE_URL_PATTERN,
} from '../../common/validation/image-url';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  // An empty field means "no image" (stored as null; on update it removes
  // the image) rather than being rejected as an invalid address.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  )
  @IsString()
  @IsOptional()
  @MaxLength(2048)
  @Matches(IMAGE_URL_PATTERN, { message: `imageUrl ${IMAGE_URL_MESSAGE}` })
  imageUrl?: string | null;

  /** Omitted = top-level category. Depth-2 cap is enforced in the service. */
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
