import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, Product } from '@/types';
import { MeasurementSet, isComplete } from '@/lib/measurements';

interface CartState {
  items: CartItem[];
  isOpen: boolean;

  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setMeasurements: (productId: string, measurements: MeasurementSet) => void;
  clearCart: () => void;
  toggleCart: () => void;
  setCartOpen: (open: boolean) => void;

  // Computed
  totalItems: () => number;
  subtotal: () => number;
  /** BR3: line items still missing the measurements their product requires. */
  itemsMissingMeasurements: () => CartItem[];
  /** BR3: checkout is blocked while any required measurements are absent. */
  canCheckout: () => boolean;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (product: Product, quantity = 1) => {
        const items = get().items;
        const existingIndex = items.findIndex(
          (item) => item.product.id === product.id,
        );

        if (existingIndex >= 0) {
          const updatedItems = [...items];
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            quantity: updatedItems[existingIndex].quantity + quantity,
          };
          set({ items: updatedItems });
        } else {
          set({ items: [...items, { product, quantity }] });
        }
      },

      removeItem: (productId: string) => {
        set({
          items: get().items.filter((item) => item.product.id !== productId),
        });
      },

      updateQuantity: (productId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }

        set({
          items: get().items.map((item) =>
            item.product.id === productId ? { ...item, quantity } : item,
          ),
        });
      },

      setMeasurements: (productId: string, measurements: MeasurementSet) => {
        set({
          items: get().items.map((item) =>
            item.product.id === productId ? { ...item, measurements } : item,
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      toggleCart: () => set({ isOpen: !get().isOpen }),

      setCartOpen: (open: boolean) => set({ isOpen: open }),

      totalItems: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

      subtotal: () =>
        get().items.reduce(
          (sum, item) => sum + Number(item.product.price) * item.quantity,
          0,
        ),

      // BR3 (doc 01 §7). This is a UX guard so the customer is told what is
      // missing before they try; the API enforces the rule for real and rejects
      // the order regardless of what this returns.
      itemsMissingMeasurements: () =>
        get().items.filter(
          (item) => !isComplete(item.product, item.measurements),
        ),

      canCheckout: () =>
        get().items.length > 0 &&
        get().itemsMissingMeasurements().length === 0,
    }),
    {
      name: 'textile-cart',
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
