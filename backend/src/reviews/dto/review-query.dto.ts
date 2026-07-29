import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const SORTABLE = ['recent', 'highest', 'lowest', 'helpful'] as const;
export type ReviewSortBy = (typeof SORTABLE)[number];

export class ReviewQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsIn(SORTABLE)
  sortBy?: ReviewSortBy;

  /** Exact star filter (1-5), not a minimum. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasPhotos?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  verifiedOnly?: boolean;
}
