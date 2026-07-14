import { MovementType } from '@prisma/client';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';

/** The three movements an admin is allowed to record by hand. */
export const ADMIN_MOVEMENT_TYPES = [
  MovementType.PURCHASE,
  MovementType.ADJUSTMENT,
  MovementType.DAMAGE,
] as const;

export type AdminMovementType = (typeof ADMIN_MOVEMENT_TYPES)[number];

export class AdjustStockDto {
  /**
   * Signed. +50 for a delivery, -3 for a damaged bolt.
   *
   * Deliberately NOT split into a positive `quantity` plus a direction, because
   * that shape lets a caller send `{ quantity: 5, type: DAMAGE }` and leaves the
   * service guessing whether they meant to add or remove. One signed number has
   * exactly one meaning.
   *
   * Bounded at ±100_000 so a slipped keypress cannot write a number nobody can
   * reconcile — the shop does not receive a hundred thousand of anything.
   */
  @IsInt()
  @NotEquals(0, { message: 'An adjustment of zero changes nothing.' })
  @Min(-100_000)
  @Max(100_000)
  change!: number;

  /**
   * RESERVE / RELEASE / SALE / INITIAL are refused here. Those belong to the
   * order lifecycle — an admin who could hand-write a SALE could invent revenue.
   */
  @IsIn(ADMIN_MOVEMENT_TYPES)
  type!: AdminMovementType;

  /**
   * Why. Free text, but the DAMAGE path is where it earns its keep: "3 metres
   * water-damaged, back store" is an audit trail; a bare -3 is an unexplained
   * loss, and unexplained losses are how stock walks out of a shop.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
