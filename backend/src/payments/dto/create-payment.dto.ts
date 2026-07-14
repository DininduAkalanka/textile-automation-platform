import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateFullPaymentDto {
  @IsUUID()
  orderId: string;
}

export class CreatePaymentDto {
  @IsUUID()
  orderId: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}
