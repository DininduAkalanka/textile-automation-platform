'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useWishlistStore } from '@/store/useWishlistStore';
import { useCartStore } from '@/store/useCartStore';
import { useState, useEffect } from 'react';
import { Product } from '@/types';

/* ── SVG Icons ─────────────────────────────────────────────── */
const IconHeart = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
  </svg>
);
const IconTrash = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4h4v2"/>
  </svg>
);
const IconBag = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
const IconArrowRight = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
);

/* ── Wishlist Item Card ─────────────────────────────────────── */
function WishlistCard({ product, index }: { product: Product; index: number }) {
  const removeItem = useWishlistStore(s => s.removeItem);
  const addItem    = useCartStore(s => s.addItem);
  const [cartState, setCartState] = useState<'idle' | 'added'>('idle');

  const initialImg = product.images && product.images.length > 0 ? product.images[0] : `/images/prod${(index % 3) + 1}.png`;
  const [imgSrc, setImgSrc] = useState<string>(initialImg);

  useEffect(() => {
    setImgSrc(product.images && product.images.length > 0 ? product.images[0] : `/images/prod${(index % 3) + 1}.png`);
  }, [product.images, index]);

  const discount = product.compareAtPrice
    ? Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)
    : 0;

  function handleAddToCart() {
    addItem(product, 1);
    setCartState('added');
    setTimeout(() => setCartState('idle'), 1800);
  }

  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--clr-surface)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        transition: 'transform 240ms ease, box-shadow 240ms ease',
        animationDelay: `${index * 0.06}s`,
      }}
      className="animate-fade-in-up"
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 30px rgba(0,0,0,0.09)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'none';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)';
      }}
    >
      {/* Image */}
      <Link href={`/products/${product.slug}`} style={{ display: 'block', textDecoration: 'none' }}>
        <div style={{ aspectRatio: '3/4', position: 'relative', overflow: 'hidden', background: 'var(--obsidian-950)' }}>
          <Image
            src={imgSrc}
            alt={product.name}
            fill
            unoptimized
            onError={() => setImgSrc(`/images/prod${(index % 3) + 1}.png`)}
            style={{ objectFit: 'cover', transition: 'transform 400ms ease' }}
            sizes="(max-width: 768px) 50vw, 25vw"
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1.04)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
          />
          {/* Badges */}
          <div style={{ position: 'absolute', top: '0.625rem', left: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', zIndex: 5 }}>
            {discount > 0 && (
              <span className="badge badge-brand">{discount}% Off</span>
            )}
          </div>
          {/* Remove overlay button */}
          <button
            onClick={e => { e.preventDefault(); removeItem(product.id); }}
            aria-label="Remove from wishlist"
            title="Remove from wishlist"
            style={{
              position: 'absolute',
              top: '0.625rem',
              right: '0.625rem',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--clr-brand)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              zIndex: 10,
              transition: 'background 150ms ease, transform 150ms ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--clr-brand)';
              (e.currentTarget as HTMLElement).style.color = '#fff';
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.95)';
              (e.currentTarget as HTMLElement).style.color = 'var(--clr-brand)';
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            <IconTrash size={14} />
          </button>
        </div>
      </Link>

      {/* Info */}
      <div style={{ padding: '1rem 1rem 1.125rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {product.category && (
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.58rem',
            fontWeight: 400,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--clr-brand)',
            marginBottom: '0.35rem',
          }}>
            {product.category.name}
          </p>
        )}

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

        {/* Price */}
        <div style={{ marginTop: 'auto', marginBottom: '0.875rem' }}>
          <span className={`price${discount > 0 ? ' price-sale' : ''}`}>
            Rs.&nbsp;{Number(product.price).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
          </span>
          {product.compareAtPrice && (
            <span className="price-was">
              Rs.&nbsp;{Number(product.compareAtPrice).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {/* Add to bag */}
        <button
          onClick={handleAddToCart}
          disabled={cartState === 'added' || product.stockQuantity <= 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: '0.625rem 1rem',
            background: product.stockQuantity <= 0
              ? 'var(--clr-border)'
              : cartState === 'added' ? '#16a34a' : 'var(--clr-brand)',
            color: product.stockQuantity <= 0 ? 'var(--clr-text-3)' : '#fff',
            border: 'none',
            borderRadius: 'var(--r-xs)',
            fontSize: '0.72rem',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: product.stockQuantity <= 0 || cartState === 'added' ? 'default' : 'pointer',
            transition: 'background 200ms ease',
          }}
        >
          {product.stockQuantity <= 0 ? (
            'Out of Stock'
          ) : cartState === 'added' ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              Added to Bag
            </>
          ) : (
            <>
              <IconBag size={13} />
              Add to Bag
            </>
          )}
        </button>
      </div>
    </article>
  );
}

/* ── Main Wishlist Page ─────────────────────────────────────── */
export default function WishlistPage() {
  const items        = useWishlistStore(s => s.items);
  const clearWishlist = useWishlistStore(s => s.clearWishlist);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2.5px solid var(--clr-border)', borderTopColor: 'var(--clr-brand)', animation: 'spin 0.8s linear infinite' }} />
      </main>
    );
  }

  return (
    <main style={{ minHeight: '70vh', paddingTop: '2.5rem', paddingBottom: '4rem' }}>
      <div className="container">

        {/* ── Page Header ─────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '2rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid var(--clr-border)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--clr-brand)' }}><IconHeart size={22} /></span>
              <h1 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(1.4rem, 3vw, 2rem)',
                fontWeight: 600,
                color: 'var(--clr-text)',
                lineHeight: 1.2,
              }}>
                My Wishlist
              </h1>
            </div>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              letterSpacing: '0.08em',
              color: 'var(--clr-text-3)',
            }}>
              {items.length === 0
                ? 'No saved items yet'
                : `${items.length} saved item${items.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {items.length > 0 && (
            <button
              onClick={() => { if (confirm('Clear your entire wishlist?')) clearWishlist(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid var(--clr-border)',
                borderRadius: 'var(--r-sm)',
                fontSize: '0.75rem',
                fontWeight: 500,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.06em',
                color: 'var(--clr-text-2)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--clr-brand)';
                (e.currentTarget as HTMLElement).style.color = 'var(--clr-brand)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--clr-border)';
                (e.currentTarget as HTMLElement).style.color = 'var(--clr-text-2)';
              }}
            >
              <IconTrash size={13} />
              Clear All
            </button>
          )}
        </div>

        {/* ── Empty State ──────────────────────────────────── */}
        {items.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '40vh',
            gap: '1.25rem',
            textAlign: 'center',
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'var(--clr-brand-tint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--clr-brand)',
              opacity: 0.6,
            }}>
              <IconHeart size={36} />
            </div>
            <div>
              <p style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--clr-text)',
                marginBottom: '0.5rem',
              }}>
                Your wishlist is empty
              </p>
              <p style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.875rem',
                color: 'var(--clr-text-3)',
                maxWidth: '360px',
              }}>
                Save products you love by clicking the heart icon on any product card.
              </p>
            </div>
            <Link
              href="/products"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.75rem',
                background: 'var(--clr-brand)',
                color: '#fff',
                borderRadius: 'var(--r-sm)',
                fontSize: '0.8rem',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                transition: 'opacity 150ms ease',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.88')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
            >
              Browse Products <IconArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* ── Product Grid ─────────────────────────────────── */}
        {items.length > 0 && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '1.5rem',
            }}>
              {items.map((product, i) => (
                <WishlistCard key={product.id} product={product} index={i} />
              ))}
            </div>

            {/* Continue Shopping */}
            <div style={{ marginTop: '3rem', textAlign: 'center' }}>
              <Link
                href="/products"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.08em',
                  color: 'var(--clr-text-2)',
                  textDecoration: 'none',
                  transition: 'color 150ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--clr-brand)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--clr-text-2)')}
              >
                <IconArrowRight size={14} />
                Continue Shopping
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
