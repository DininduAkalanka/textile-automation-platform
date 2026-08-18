'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Product } from '@/types';

const KEY = 'nt_recently_viewed';
const MAX = 12;

/**
 * Recently-viewed products, kept entirely in the browser (localStorage) — no
 * backend, no ML, just a memory of what this visitor clicked. Snapshots are
 * stored whole so the rail renders instantly with no extra requests.
 */
export function useRecentlyViewed() {
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw) as Product[]);
    } catch {
      // corrupt/blocked storage — behave as if empty
    }
  }, []);

  /** Push a product to the front (most-recent-first, de-duplicated, capped). */
  const record = useCallback((product: Product) => {
    try {
      const raw = localStorage.getItem(KEY);
      const prev: Product[] = raw ? JSON.parse(raw) : [];
      const next = [product, ...prev.filter((p) => p.id !== product.id)].slice(
        0,
        MAX,
      );
      localStorage.setItem(KEY, JSON.stringify(next));
      setItems(next);
    } catch {
      // storage unavailable — skip silently
    }
  }, []);

  return { items, record };
}
