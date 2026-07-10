import { IsString, IsUUID, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';

export enum PaymentPlanType {
  FULL = 'FULL',
  INSTALLMENT = 'INSTALLMENT',
}

export class CreateFullPaymentDto {
  @IsUUID()
  orderId: string;
}

export class CreateInstallmentPaymentDto {
  @IsUUID()
  orderId: string;

  @IsInt()
  @Min(2)
  @Max(4)
  installmentCount: number;
}

export class CreatePaymentDto {
  @IsUUID()
  orderId: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}
