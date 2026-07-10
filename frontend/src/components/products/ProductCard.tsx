'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';
import { useModalStore } from '@/store/useModalStore';

/* ── Color palette for placeholder backgrounds ─────────────── */
const PLATE_BG = [
  ['#0d0d0d','#1a0000'],
  ['#0a0a0a','#001020'],
  ['#0a0000','#200a00'],
  ['#06060d','#100618'],
  ['#000a06','#001a10'],
  ['#0a0a00','#1a1a00'],
];

/* ── Category label helper ─────────────────────────────────── */
function categoryTag(name?: string): string {
  if (!name) return '';
  return name;
}

interface Props {
  product: Product;
  index?: number;
}

export default function ProductCard({ product, index = 0 }: Props) {
  const addItem        = useCartStore(s => s.addItem);
  const toggleItem     = useWishlistStore(s => s.toggleItem);
  const wishlistItems  = useWishlistStore(s => s.items);
  const openQuickView  = useModalStore(s => s.openQuickView);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const wishlisted     = mounted && wishlistItems.some(i => i.id === product.id);
  const [cartState,  setCartState]  = useState<'idle' | 'added'>('idle');

  console.log('ProductCard Render:', {
    id: product.id,
    name: product.name,
    mounted,
    wishlistItemsCount: wishlistItems.length,
    wishlisted,
  });

  const initialImg = product.images && product.images.length > 0 ? product.images[0] : `/images/prod${(index % 3) + 1}.png`;
  const [imgSrc, setImgSrc] = useState<string>(initialImg);

  useEffect(() => {
    setImgSrc(product.images && product.images.length > 0 ? product.images[0] : `/images/prod${(index % 3) + 1}.png`);
  }, [product.images, index]);

  const discount = product.compareAtPrice
    ? Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)
    : 0;

  const plate = PLATE_BG[index % PLATE_BG.length];
  const isNew = index < 4 && !discount;

  function handleCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
    setCartState('added');
    setTimeout(() => setCartState('idle'), 1800);
  }

  function handleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.log('handleWishlist Clicked:', {
      productId: product.id,
      alreadyWishlisted: wishlisted,
    });
    toggleItem(product);
  }

  return (
    <article
      className="product-card animate-fade-in-up"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--clr-surface)',
        border: 'none',
        borderRadius: '0px', // More modern fashion editorial look
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        animationDelay: `${index * 0.055}s`,
        transition: 'border-color 240ms ease, box-shadow 240ms ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow  = '0 12px 30px rgba(0,0,0,0.08)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow  = '0 4px 20px rgba(0,0,0,0.04)';
        (e.currentTarget as HTMLElement).style.transform = 'none';
      }}
    >
      {/* ── Image Wrapper ────────────────────────────────────── */}
      <div className="product-card-img-wrap" style={{ aspectRatio: '3/4', position: 'relative' }}>
        {/* The main click target link for the product details */}
        <Link
          href={`/products/${product.slug}`}
          aria-label={product.name}
          style={{ display: 'block', width: '100%', height: '100%' }}
        >
          {/* Product Image */}
          <div
            className="product-card-img-inner"
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              overflow: 'hidden',
              background: 'var(--obsidian-950)'
            }}
          >
            <Image
              src={imgSrc}
              alt={product.name}
              fill
              unoptimized
              onError={() => setImgSrc(`/images/prod${(index % 3) + 1}.png`)}
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          </div>
        </Link>

        {/* Quick-view overlay */}
        <div className="product-card-actions">
          <button
            onClick={handleCart}
            id={`add-cart-${product.id}`}
            disabled={cartState === 'added'}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1rem',
              background: cartState === 'added' ? '#16a34a' : 'var(--clr-brand)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--r-xs)',
              fontSize: '0.72rem',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: cartState === 'added' ? 'default' : 'pointer',
              transition: 'background 200ms ease',
            }}
          >
            {cartState === 'added' ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                Added
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
                Add to Bag
              </>
            )}
          </button>
        </div>

        {/* Overlay Action Buttons Stack (Wishlist, Quick View, Visual Search) */}
        <div className="product-card-overlay-actions">
          {/* Wishlist Button */}
          <button
            onClick={handleWishlist}
            id={`wishlist-${product.id}`}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            className={`overlay-action-btn${wishlisted ? ' active wishlisted' : ''}`}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill={wishlisted ? '#cc0000' : 'none'}
              stroke={wishlisted ? '#cc0000' : 'currentColor'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
          </button>

          {/* Quick View Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openQuickView(product);
            }}
            id={`quick-view-${product.id}`}
            aria-label="Quick view product"
            className="overlay-action-btn"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        {/* Badges */}
        <div style={{ position: 'absolute', top: '0.625rem', left: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', zIndex: 5 }}>
          {discount > 0 && <span className="badge badge-brand">{discount}% Off</span>}
          {isNew       && <span className="badge badge-dark">New</span>}
          {product.stockQuantity <= 5 && product.stockQuantity > 0 && (
            <span className="badge badge-gold">Low Stock</span>
          )}
        </div>
      </div>

      {/* ── Info ────────────────────────────────────────────── */}
      <div style={{ padding: '1.125rem 1.125rem 1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Category */}
        {product.category && (
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.58rem',
              fontWeight: 400,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--clr-brand)',
              marginBottom: '0.375rem',
            }}
          >
            {categoryTag(product.category.name)}
          </p>
        )}

        {/* Name */}
        <Link
          href={`/products/${product.slug}`}
          className="line-clamp-2"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.875rem',
            fontWeight: 600,
            lineHeight: 1.45,
            color: 'var(--clr-text)',
            textDecoration: 'none',
            marginBottom: '0.5rem',
            transition: 'color 150ms ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--clr-brand)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--clr-text)')}
        >
          {product.name}
        </Link>

        {/* Attributes */}
        {(product.attributes?.color || product.attributes?.gsm) && (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
            {product.attributes?.color && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6rem',
                  fontWeight: 400,
                  letterSpacing: '0.08em',
                  color: 'var(--clr-text-3)',
                  padding: '0.15rem 0.45rem',
                  border: '1px solid var(--clr-border-2)',
                  borderRadius: 'var(--r-xs)',
                }}
              >
                {product.attributes.color}
              </span>
            )}
            {product.attributes?.gsm && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6rem',
                  fontWeight: 400,
                  letterSpacing: '0.08em',
                  color: 'var(--clr-text-3)',
                  padding: '0.15rem 0.45rem',
                  border: '1px solid var(--clr-border-2)',
                  borderRadius: 'var(--r-xs)',
                }}
              >
                {product.attributes.gsm} GSM
              </span>
            )}
          </div>
        )}

        {/* Price row */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span
              className={`price${discount > 0 ? ' price-sale' : ''}`}
            >
              Rs.&nbsp;{Number(product.price).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
            </span>
            {product.compareAtPrice && (
              <span className="price-was">
                Rs.&nbsp;{Number(product.compareAtPrice).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
          {/* BNPL Installment Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.62rem', color: 'var(--clr-text-3)', fontFamily: 'var(--font-mono)' }}>
            <span>Or 3 x Rs. {Math.round(Number(product.price) / 3).toLocaleString('en-LK')} with</span>
            <span style={{ fontWeight: 700, color: 'var(--clr-text-2)', background: 'var(--clr-surface-3)', padding: '1px 4px', borderRadius: '2px', fontSize: '0.55rem', letterSpacing: '0.04em' }}>KOKO</span>
          </div>
        </div>

        {/* Low stock warning */}
        {product.stockQuantity <= 10 && product.stockQuantity > 0 && (
          <p
            style={{
              marginTop: '0.5rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              letterSpacing: '0.08em',
              color: 'var(--clr-brand)',
              fontWeight: 400,
            }}
          >
            Only {product.stockQuantity} remaining
          </p>
        )}
      </div>
    </article>
  );
}
