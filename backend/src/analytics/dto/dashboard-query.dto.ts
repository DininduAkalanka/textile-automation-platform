import { IsISO8601, IsOptional } from 'class-validator';

export class DashboardQueryDto {
  /** Inclusive start of the reporting window. Defaults to 30 days ago. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Inclusive end of the reporting window. Defaults to now. */
  @IsOptional()
  @IsISO8601()
  to?: string;
}
