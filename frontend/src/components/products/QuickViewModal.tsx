'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useModalStore } from '@/store/useModalStore';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';

export default function QuickViewModal() {
  const { quickViewProduct, closeQuickView } = useModalStore();
  const addItem = useCartStore((s) => s.addItem);
  const toggleWishlist = useWishlistStore((s) => s.toggleItem);
  const wishlistItems = useWishlistStore((s) => s.items);

  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState('M');
  const [selectedColor, setSelectedColor] = useState('');
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [cartState, setCartState] = useState<'idle' | 'adding' | 'added'>('idle');
  const [mounted, setMounted] = useState(false);
  const [zoomStyle, setZoomStyle] = useState({ display: 'none', backgroundPosition: '0% 0%' });

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Set default color when product changes
  useEffect(() => {
    if (quickViewProduct) {
      setQuantity(1);
      setActiveImageIdx(0);
      setCartState('idle');
      if (quickViewProduct.attributes?.color) {
        setSelectedColor(quickViewProduct.attributes.color);
      } else {
        setSelectedColor('');
      }
    }
  }, [quickViewProduct]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeQuickView();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeQuickView]);

  if (!quickViewProduct) return null;

  const product = quickViewProduct;
  const isWishlisted = mounted && wishlistItems.some((i) => i.id === product.id);

  const discount = product.compareAtPrice
    ? Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)
    : 0;

  const images = product.images && product.images.length > 0
    ? product.images
    : [`/images/prod1.png`]; // Fallback

  const handleAddToCart = () => {
    setCartState('adding');
    setTimeout(() => {
      // Pass selected attributes to cart item
      addItem(
        {
          ...product,
          attributes: {
            ...product.attributes,
            selectedSize,
            selectedColor,
          },
        },
        quantity
      );
      setCartState('added');
      setTimeout(() => setCartState('idle'), 1800);
    }, 600);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({
      display: 'block',
      backgroundPosition: `${x}% ${y}%`,
    });
  };

  const handleMouseLeave = () => {
    setZoomStyle({ display: 'none', backgroundPosition: '0% 0%' });
  };

  // Prevent scroll when modal is open
  if (typeof document !== 'undefined') {
    document.body.style.overflow = 'hidden';
  }

  const handleClose = () => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
    closeQuickView();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      className="animate-fade-in"
    >
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          transition: 'all 0.3s ease',
        }}
      />

      {/* Modal Container */}
      <div
        ref={modalRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '960px',
          maxHeight: 'min(90vh, 650px)',
          background: 'var(--clr-surface)',
          borderRadius: '0px',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'minmax(350px, 1fr) 1.2fr',
          zIndex: 1000,
          animation: 'scaleIn 0.35s var(--ease-spring) both',
        }}
        className="quick-view-grid"
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          aria-label="Close modal"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 10,
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '50%',
            background: 'var(--clr-surface)',
            border: '1px solid var(--clr-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--clr-text)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--clr-brand)';
            e.currentTarget.style.color = 'var(--clr-brand)';
            e.currentTarget.style.transform = 'rotate(90deg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--clr-border)';
            e.currentTarget.style.color = 'var(--clr-text)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Left Side: Images */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--obsidian-50)',
            borderRight: '1px solid var(--clr-border-2)',
            height: '100%',
            maxHeight: '650px',
            overflow: 'hidden',
          }}
        >
          {/* Main Image Viewport with Hover Zoom */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              cursor: 'crosshair',
              overflow: 'hidden',
              background: '#0d0d0d',
              aspectRatio: '3/4',
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <Image
              src={images[activeImageIdx]}
              alt={product.name}
              fill
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 960px) 50vw, 400px"
              unoptimized
            />

            {/* Hover Magnifying Zoom */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${images[activeImageIdx]})`,
                backgroundSize: '200%',
                backgroundRepeat: 'no-repeat',
                pointerEvents: 'none',
                ...zoomStyle,
              }}
            />

            {/* Discount Badge */}
            {discount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '1rem',
                  background: 'var(--clr-brand)',
                  color: 'white',
                  padding: '0.25rem 0.625rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  zIndex: 2,
                }}
              >
                {discount}% Off
              </span>
            )}
          </div>

          {/* Thumbnails Row */}
          {images.length > 1 && (
            <div
              style={{
                padding: '0.75rem',
                display: 'flex',
                gap: '0.5rem',
                background: 'var(--clr-surface)',
                borderTop: '1px solid var(--clr-border-2)',
                overflowX: 'auto',
              }}
            >
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImageIdx(i)}
                  style={{
                    position: 'relative',
                    width: '50px',
                    height: '65px',
                    border: activeImageIdx === i ? '2px solid var(--clr-brand)' : '1px solid var(--clr-border)',
                    overflow: 'hidden',
                    flexShrink: 0,
                    cursor: 'pointer',
                    background: 'var(--obsidian-50)',
                  }}
                >
                  <Image
                    src={img}
                    alt={`thumbnail-${i}`}
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="50px"
                    unoptimized
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Product Details */}
        <div
          style={{
            padding: '2.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflowY: 'auto',
            maxHeight: '650px',
          }}
        >
          <div>
            {/* Category / Eyebrow */}
            {product.category && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: 'var(--clr-brand)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  display: 'block',
                  marginBottom: '0.5rem',
                }}
              >
                {product.category.name}
              </span>
            )}

            {/* Name */}
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.75rem',
                fontWeight: 600,
                lineHeight: 1.25,
                color: 'var(--clr-text)',
                marginBottom: '1rem',
              }}
            >
              {product.name}
            </h2>

            {/* Price section */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <span
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: discount > 0 ? 'var(--clr-brand)' : 'var(--clr-text)',
                }}
              >
                Rs. {Number(product.price).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </span>
              {product.compareAtPrice && (
                <span
                  style={{
                    fontSize: '1rem',
                    color: 'var(--clr-text-3)',
                    textDecoration: 'line-through',
                  }}
                >
                  Rs. {Number(product.compareAtPrice).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {/* Koko BNPL Callout */}
            <div
              style={{
                padding: '0.625rem 0.875rem',
                background: 'var(--clr-surface-2)',
                border: '1px solid var(--clr-border-2)',
                fontSize: '0.72rem',
                color: 'var(--clr-text-2)',
                fontFamily: 'var(--font-mono)',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>Or 3 interest-free installments of <strong style={{ color: 'var(--clr-text)' }}>Rs. {Math.round(Number(product.price) / 3).toLocaleString('en-LK')}</strong> with</span>
              <span style={{ background: 'var(--clr-text)', color: 'white', padding: '1px 5px', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.04em' }}>KOKO</span>
            </div>

            {/* Description */}
            {product.description && (
              <p
                style={{
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  color: 'var(--clr-text-2)',
                  marginBottom: '1.75rem',
                }}
              >
                {product.description}
              </p>
            )}

            {/* Attribute Selectors */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
              {/* Color Swatch */}
              {product.attributes?.color && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--clr-text-2)' }}>
                      Color: <strong style={{ color: 'var(--clr-text)' }}>{selectedColor || product.attributes.color}</strong>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setSelectedColor(product.attributes.color)}
                      style={{
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.75rem',
                        border: selectedColor === product.attributes.color ? '2px solid var(--clr-brand)' : '1px solid var(--clr-border)',
                        background: 'transparent',
                        color: 'var(--clr-text)',
                        cursor: 'pointer',
                        fontWeight: selectedColor === product.attributes.color ? 600 : 400,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {product.attributes.color}
                    </button>
                  </div>
                </div>
              )}

              {/* Sizes (Simulated generic catalog sizes for preview) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--clr-text-2)' }}>
                    Size: <strong style={{ color: 'var(--clr-text)' }}>{selectedSize}</strong>
                  </span>
                  <a
                    href="#size-guide"
                    style={{ fontSize: '0.72rem', color: 'var(--clr-brand)', textDecoration: 'underline', fontFamily: 'var(--font-mono)' }}
                    onClick={(e) => {
                      e.preventDefault();
                      alert('Size Guide: Standard Regular Fit. S: 36", M: 38", L: 40", XL: 42".');
                    }}
                  >
                    Size Guide
                  </a>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['S', 'M', 'L', 'XL'].map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontFamily: 'var(--font-mono)',
                        border: selectedSize === size ? '2.2px solid var(--clr-text)' : '1px solid var(--clr-border)',
                        background: selectedSize === size ? 'var(--clr-text)' : 'transparent',
                        color: selectedSize === size ? 'white' : 'var(--clr-text)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div style={{ borderTop: '1px solid var(--clr-border-2)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {/* Qty Selector */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid var(--clr-border)',
                  height: '2.75rem',
                  padding: '0 0.5rem',
                }}
              >
                <button
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => q - 1)}
                  style={{
                    width: '1.75rem',
                    height: '100%',
                    fontSize: '1rem',
                    color: quantity <= 1 ? 'var(--clr-text-3)' : 'var(--clr-text)',
                    cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    width: '2.25rem',
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  style={{
                    width: '1.75rem',
                    height: '100%',
                    fontSize: '1rem',
                    color: 'var(--clr-text)',
                    cursor: 'pointer',
                  }}
                >
                  +
                </button>
              </div>

              {/* Add to Bag Button */}
              <button
                onClick={handleAddToCart}
                disabled={cartState === 'adding' || product.stockQuantity <= 0}
                style={{
                  flex: 1,
                  height: '2.75rem',
                  background: cartState === 'added' ? '#16a34a' : 'var(--clr-brand)',
                  color: 'white',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: product.stockQuantity <= 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (cartState === 'idle' && product.stockQuantity > 0) {
                    e.currentTarget.style.background = 'var(--clr-brand-dark)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (cartState === 'idle' && product.stockQuantity > 0) {
                    e.currentTarget.style.background = 'var(--clr-brand)';
                  }
                }}
              >
                {product.stockQuantity <= 0 ? (
                  'Out of Stock'
                ) : cartState === 'adding' ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    Adding...
                  </>
                ) : cartState === 'added' ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Added to Bag
                  </>
                ) : (
                  'Add to Bag'
                )}
              </button>

              {/* Wishlist Button */}
              <button
                onClick={() => toggleWishlist(product)}
                style={{
                  width: '2.75rem',
                  height: '2.75rem',
                  border: '1px solid var(--clr-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isWishlisted ? 'var(--clr-brand)' : 'var(--clr-text-3)',
                  cursor: 'pointer',
                  background: 'transparent',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--clr-brand)';
                  e.currentTarget.style.color = 'var(--clr-brand)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--clr-border)';
                  e.currentTarget.style.color = isWishlisted ? 'var(--clr-brand)' : 'var(--clr-text-3)';
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill={isWishlisted ? 'var(--clr-brand)' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </button>
            </div>

            {/* View Full Product Link */}
            <Link
              href={`/products/${product.slug}`}
              onClick={handleClose}
              style={{
                textAlign: 'center',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--clr-text-2)',
                textDecoration: 'underline',
                cursor: 'pointer',
                display: 'block',
                marginTop: '0.25rem',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--clr-brand)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--clr-text-2)')}
            >
              View Full Product Details
            </Link>
          </div>
        </div>
      </div>

      {/* Tailwind and custom CSS overrides inside component */}
      <style jsx global>{`
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @media (max-width: 768px) {
          .quick-view-grid {
            grid-template-columns: 1fr !important;
            max-height: 95vh !important;
            overflow-y: auto !important;
          }
          .quick-view-grid > div {
            max-height: none !important;
          }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
