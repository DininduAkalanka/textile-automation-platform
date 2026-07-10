import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '@/types';

interface WishlistState {
  items: Product[];

  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  toggleItem: (product: Product) => void;
  isWishlisted: (productId: string) => boolean;
  clearWishlist: () => void;

  // Computed
  totalItems: () => number;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product: Product) => {
        const exists = get().items.some(i => i.id === product.id);
        if (!exists) {
          set({ items: [...get().items, product] });
        }
      },

      removeItem: (productId: string) => {
        set({ items: get().items.filter(i => i.id !== productId) });
      },

      toggleItem: (product: Product) => {
        const exists = get().items.some(i => i.id === product.id);
        if (exists) {
          set({ items: get().items.filter(i => i.id !== product.id) });
        } else {
          set({ items: [...get().items, product] });
        }
      },

      isWishlisted: (productId: string) =>
        get().items.some(i => i.id === productId),

      clearWishlist: () => set({ items: [] }),

      totalItems: () => get().items.length,
    }),
    {
      name: 'textile-wishlist',
    },
  ),
);
