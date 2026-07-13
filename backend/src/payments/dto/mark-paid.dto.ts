import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkPaidDto {
  /** Plan 7.1 task 2: every admin action gets an optional note. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
