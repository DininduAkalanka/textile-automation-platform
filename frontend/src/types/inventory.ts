/** The three movements an admin may record by hand. The rest belong to orders. */
export type AdjustmentType = 'PURCHASE' | 'ADJUSTMENT' | 'DAMAGE';

export type MovementType =
  | 'INITIAL'
  | 'RESERVE'
  | 'RELEASE'
  | 'SALE'
  | AdjustmentType;

/**
 * OUT is not "LOW but worse" — it is a different problem. A LOW product still
 * sells while you reorder; an OUT one is turning customers away right now.
 */
export type StockStatus = 'OK' | 'LOW' | 'OUT';

export interface InventoryItem {
  productId: string;
  name: string;
  sku: string;
  category: string | null;
  /** Physically on the shelf. */
  available: number;
  /** Spoken for by orders already placed. */
  reserved: number;
  /** What a customer can actually buy right now: available - reserved. */
  sellable: number;
  /** The reorder threshold. */
  minimum: number;
  status: StockStatus;
  updatedAt: string;
}

export interface Movement {
  id: string;
  type: MovementType;
  /** Signed. RELEASE, SALE and DAMAGE arrive negative. */
  quantityChange: number;
  note: string | null;
  createdAt: string;
  /** Exactly one of these is set (INITIAL has neither — it is the opening balance). */
  orderNumber: string | null;
  adminName: string | null;
}

export interface InventoryPage {
  items: InventoryItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface MovementPage {
  items: Movement[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface LowStockSummary {
  count: number;
  items: InventoryItem[];
}

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  INITIAL: 'Opening balance',
  RESERVE: 'Reserved for an order',
  RELEASE: 'Reservation released',
  SALE: 'Sold',
  PURCHASE: 'Stock received',
  ADJUSTMENT: 'Manual correction',
  DAMAGE: 'Written off',
};

export const ADJUSTMENT_OPTIONS: Array<{
  value: AdjustmentType;
  label: string;
  hint: string;
  /** The sign is implied by the type — a "DAMAGE +50" is a data-entry error. */
  direction: 'up' | 'down' | 'both';
}> = [
  {
    value: 'PURCHASE',
    label: 'Stock received',
    hint: 'A delivery arrived from a supplier.',
    direction: 'up',
  },
  {
    value: 'ADJUSTMENT',
    label: 'Correction',
    hint: 'A stock count disagreed with the system.',
    direction: 'both',
  },
  {
    value: 'DAMAGE',
    label: 'Damage / write-off',
    hint: 'Stock is unsellable and is leaving the books.',
    direction: 'down',
  },
];
