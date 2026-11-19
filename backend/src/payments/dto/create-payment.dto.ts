import { IsInt, IsString, IsUUID, IsOptional, Max, Min } from 'class-validator';

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

export class CreateInstallmentPaymentDto {
  @IsUUID()
  orderId: string;

  // QA P1-7: was completely unvalidated — 0, "abc", -2, 2.5 and 500 were all
  // accepted. A whole number of monthly payments, 2 to 6.
  @IsOptional()
  @IsInt({ message: 'installmentCount must be a whole number' })
  @Min(2)
  @Max(6)
  installmentCount?: number;
}

export class PayInstallmentDto {
  @IsUUID()
  installmentId: string;
}
