import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { OrderAction } from '../order.machine';

const ACTIONS: OrderAction[] = ['cancel', 'advance', 'deliver'];

export class OrderActionDto {
  @IsIn(ACTIONS, { message: `action must be one of: ${ACTIONS.join(', ')}` })
  action!: OrderAction;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /**
   * Required by the service — not by validation here — when cancelling an order
   * whose payment is COMPLETED. class-validator has no way to express "required
   * only when action=cancel AND the payment turns out to be paid", because that
   * second fact is not on this DTO at all; it is a row the service has to load.
   * The 400 an admin sees for forgetting this is deliberately specific: "this
   * order is paid in full", not a generic validation error.
   */
  @IsOptional()
  @IsBoolean()
  acknowledgeRefund?: boolean;
}
