'use client';

import Link from 'next/link';
import { Ruler } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { formatLKR } from '@/lib/format';
import { ChatProduct } from '@/services/ai.service';
import { useCartStore } from '@/store/useCartStore';
import { useChatStore } from '@/store/useChatStore';
import { Product } from '@/types';

/**
 * A product inside the chat (plan Session 9.3, task 1).
 *
 * The stock and price shown here came from the DATABASE, not the model — the AI
 * service hydrates every card by id before returning it. So "Add to cart" can be
 * trusted: we are not offering a price the model invented.
 */
export function ChatProductCard({ product }: { product: ChatProduct }) {
  const addItem = useCartStore((s) => s.addItem);
  const setOpen = useChatStore((s) => s.setOpen);

  const outOfStock = product.stock <= 0;

  const handleAdd = () => {
    // The cart needs a full Product; the chat card carries what the customer can
    // actually see. The server recomputes price and stock at checkout anyway, so
    // an incomplete snapshot here can never become a wrong order.
    addItem(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        stockQuantity: product.stock,
        images: product.image ? [product.image] : [],
        requiresMeasurement: product.requiresMeasurement,
        slug: product.id,
      } as unknown as Product,
      1,
    );

    toast.success(
      product.requiresMeasurement
        ? `${product.name} added — measurements needed at checkout`
        : `${product.name} added to cart`,
    );
  };

  return (
    <div className="w-44 shrink-0 rounded-xl border border-neutral-200 bg-white p-2.5">
      <Link
        href={`/products/${product.id}`}
        onClick={() => setOpen(false)}
        className="block"
      >
        <p className="line-clamp-2 text-sm font-medium leading-snug text-neutral-900">
          {product.name}
        </p>
        <p className="mt-1 text-sm font-semibold text-neutral-900">
          {formatLKR(product.price)}
        </p>
      </Link>

      {product.requiresMeasurement && (
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-700">
          <Ruler size={11} aria-hidden />
          Made to measure
        </p>
      )}

      <p className="mt-0.5 text-[11px] text-neutral-500">
        {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
      </p>

      <Button
        size="sm"
        className="mt-2 w-full"
        disabled={outOfStock}
        onClick={handleAdd}
      >
        {outOfStock ? 'Out of stock' : 'Add to cart'}
      </Button>
    </div>
  );
}
