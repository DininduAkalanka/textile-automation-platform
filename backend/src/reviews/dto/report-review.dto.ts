import { IsString, Length } from 'class-validator';

export class ReportReviewDto {
  @IsString()
  @Length(3, 500)
  reason: string;
}
