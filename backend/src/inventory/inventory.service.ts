import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, MovementType } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Inventory ledger operations (decisions D2/D3). The `inventory` table is the
 * single source of truth for stock; every mutation is a guarded, race-safe
 * UPDATE plus an append-only `inventory_movements` row, all inside the caller's
 * transaction.
 *
 * `products.stock_quantity` is kept as a denormalized cache of SELLABLE stock
 * (quantity_available - quantity_reserved) so the existing read path/frontend
 * keep working unchanged. It is updated in the same transaction as the ledger.
 * It will be dropped once product reads join `inventory` directly.
 *
 * Sign convention for quantity_change: RESERVE=+qty, RELEASE=-qty, SALE=-qty,
 * PURCHASE/positive-ADJUSTMENT=+qty. SALE decrements BOTH available and reserved.
 */
@Injectable()
export class InventoryService {
  /** Order placed: reserve stock. Guarded UPDATE prevents overselling under races. */
  async reserve(
    tx: Tx,
    productId: string,
    quantity: number,
    orderId: string,
    productName?: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE inventory
         SET quantity_reserved = quantity_reserved + ${quantity}::int,
             updated_at = now()
       WHERE product_id = ${productId}::uuid
         AND quantity_available - quantity_reserved >= ${quantity}::int
      RETURNING id`;

    if (rows.length !== 1) {
      throw new BadRequestException(
        `Insufficient stock for "${productName ?? productId}"`,
      );
    }

    await tx.inventoryMovement.create({
      data: {
        inventoryId: rows[0].id,
        type: MovementType.RESERVE,
        quantityChange: quantity,
        orderId,
      },
    });

    // Sellable cache decreases by the reserved amount.
    await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: { decrement: quantity } },
    });
  }

  /** Payment/COD confirmed: convert reservation into a sale. */
  async sale(
    tx: Tx,
    productId: string,
    quantity: number,
    orderId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE inventory
         SET quantity_available = quantity_available - ${quantity}::int,
             quantity_reserved  = quantity_reserved  - ${quantity}::int,
             updated_at = now()
       WHERE product_id = ${productId}::uuid
         AND quantity_reserved  >= ${quantity}::int
         AND quantity_available >= ${quantity}::int
      RETURNING id`;

    if (rows.length !== 1) {
      throw new BadRequestException(
        `Cannot complete sale for product ${productId}: reservation missing`,
      );
    }

    await tx.inventoryMovement.create({
      data: {
        inventoryId: rows[0].id,
        type: MovementType.SALE,
        quantityChange: -quantity,
        orderId,
      },
    });
    // Sellable cache (available - reserved) is unchanged by a sale.
  }

  /** Cancellation/failure of a not-yet-sold order: release the reservation. */
  async release(
    tx: Tx,
    productId: string,
    quantity: number,
    orderId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE inventory
         SET quantity_reserved = quantity_reserved - ${quantity}::int,
             updated_at = now()
       WHERE product_id = ${productId}::uuid
         AND quantity_reserved >= ${quantity}::int
      RETURNING id`;

    if (rows.length !== 1) {
      throw new BadRequestException(
        `Cannot release reservation for product ${productId}`,
      );
    }

    await tx.inventoryMovement.create({
      data: {
        inventoryId: rows[0].id,
        type: MovementType.RELEASE,
        quantityChange: -quantity,
        orderId,
      },
    });

    // Sellable cache increases as the reservation is freed.
    await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: { increment: quantity } },
    });
  }

  /** Cancellation of an already-sold order: return stock to available. */
  async restock(
    tx: Tx,
    productId: string,
    quantity: number,
    orderId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE inventory
         SET quantity_available = quantity_available + ${quantity}::int,
             updated_at = now()
       WHERE product_id = ${productId}::uuid
      RETURNING id`;

    if (rows.length !== 1) {
      throw new BadRequestException(`Cannot restock product ${productId}`);
    }

    await tx.inventoryMovement.create({
      data: {
        inventoryId: rows[0].id,
        type: MovementType.ADJUSTMENT,
        quantityChange: quantity,
        orderId,
        note: 'Restock from cancelled order',
      },
    });

    await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: { increment: quantity } },
    });
  }
}
