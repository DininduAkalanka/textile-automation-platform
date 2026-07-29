import { ReviewSizeFeedback } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  productId: string;

  /**
   * Which DELIVERED order this review is earned from. The client only ever
   * sees this via GET /reviews/eligibility/:productId (it can't guess a
   * valid one), and the service re-verifies it belongs to the caller and is
   * DELIVERED before ever trusting it — see ReviewsService.create.
   */
  @IsUUID()
  orderId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @Length(3, 120)
  title: string;

  @IsString()
  @Length(10, 2000)
  comment: string;

  @IsInt()
  @Min(1)
  @Max(5)
  fabricRating: number;

  @IsInt()
  @Min(1)
  @Max(5)
  colorAccuracyRating: number;

  @IsInt()
  @Min(1)
  @Max(5)
  comfortRating: number;

  @IsEnum(ReviewSizeFeedback)
  sizeFeedback: ReviewSizeFeedback;

  @IsBoolean()
  wouldRecommend: boolean;

  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  images: string[] = [];
}
