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

  @IsString()
  @IsOptional()
  @MaxLength(2048)
  @Matches(IMAGE_URL_PATTERN, { message: `imageUrl ${IMAGE_URL_MESSAGE}` })
  imageUrl?: string;

  /** Omitted = top-level category. Depth-2 cap is enforced in the service. */
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
