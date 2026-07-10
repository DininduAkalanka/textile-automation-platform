import { create } from 'zustand';
import { Product } from '@/types';

interface ModalState {
  quickViewProduct: Product | null;
  visualSearchOpen: boolean;
  
  openQuickView: (product: Product) => void;
  closeQuickView: () => void;
  openVisualSearch: () => void;
  closeVisualSearch: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  quickViewProduct: null,
  visualSearchOpen: false,

  openQuickView: (product) => set({ quickViewProduct: product }),
  closeQuickView: () => set({ quickViewProduct: null }),
  openVisualSearch: () => set({ visualSearchOpen: true }),
  closeVisualSearch: () => set({ visualSearchOpen: false }),
}));
