import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

/**
 * `stockQuantity` is deliberately omitted.
 *
 * It is a denormalized cache of `inventory.quantity_available -
 * quantity_reserved`. Writing it here would move the cache without writing an
 * `inventory_movements` row, silently desyncing it from the ledger and breaking
 * the reconciliation invariant. Stock changes belong to the inventory
 * adjustment endpoint (plan Session 5.1), which is transactional and writes a
 * movement.
 *
 * The global ValidationPipe runs with `forbidNonWhitelisted: true`, so a request
 * that still sends `stockQuantity` gets a 400 naming the field rather than being
 * silently ignored.
 */
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['stockQuantity'] as const),
) {}
