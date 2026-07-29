import { OmitType, PartialType } from '@nestjs/mapped-types';

import { CreateReviewDto } from './create-review.dto';

/** Editing an existing review never moves it to a different order/product. */
export class UpdateReviewDto extends PartialType(
  OmitType(CreateReviewDto, ['productId', 'orderId'] as const),
) {}
