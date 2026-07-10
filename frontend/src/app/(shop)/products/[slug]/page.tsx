'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Product } from '@/types';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';

// ── Size chart data for tailored items ──────────────────────────
const SIZE_CHART = [
  { size: 'S', chest: '36"', length: '26"' },
  { size: 'M', chest: '38"', length: '27"' },
  { size: 'L', chest: '40"', length: '28"' },
];

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const { toggleItem, isWishlisted } = useWishlistStore();
  const isSaved = product ? isWishlisted(product.id) : false;

  // Tabs state
  const [activeTab, setActiveTab] = useState<'description' | 'fit' | 'shipping'>('description');

  useEffect(() => {
    if (slug) {
      api.getProductBySlug(slug).then(setProduct).catch(console.error).finally(() => setLoading(false));
    }
  }, [slug]);

  const handleAddToCart = () => {
    if (product) {
      addItem(product, quantity);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '3rem 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
          <div className="skeleton" style={{ height: '500px' }} />
          <div>
            <div className="skeleton" style={{ height: '2rem', width: '60%', marginBottom: '1rem' }} />
            <div className="skeleton" style={{ height: '1rem', width: '40%', marginBottom: '2rem' }} />
            <div className="skeleton" style={{ height: '6rem', marginBottom: '2rem' }} />
            <div className="skeleton" style={{ height: '3rem', width: '200px' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>😕</p>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Product Not Found</h2>
        <Link href="/products" className="btn btn-primary" style={{ marginTop: '1rem' }}>Back to Products</Link>
      </div>
    );
  }

  const discount = product.compareAtPrice
    ? Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)
    : 0;

  // Build a rich description fallback if the product description is short
  const fullDescription = product.description ||
    `This ${product.name} is crafted from premium ${product.attributes?.fabricType || 'quality'} fabric, designed for both comfort and style. Each piece is tailored with precision to ensure the perfect fit, making it ideal for any occasion. The design incorporates modern aesthetics with traditional craftsmanship, resulting in a garment that is both elegant and durable.`;

  return (
    <div className="container" style={{ padding: '2rem 0 5rem' }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--color-text-muted)' }}>Home</Link>
        <span>/</span>
        <Link href="/products" style={{ textDecoration: 'none', color: 'var(--color-text-muted)' }}>Products</Link>
        <span>/</span>
        <span style={{ color: 'var(--color-text)' }}>{product.name}</span>
      </nav>

      <div className="product-detail-grid">
        {/* Image */}
        <div
          style={{
            borderRadius: '1rem',
            overflow: 'hidden',
            background: 'var(--clr-surface-2)',
            aspectRatio: '3 / 4',
            position: 'relative',
          }}
        >
          {discount > 0 && (
            <div className="sale-tag" style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10, fontSize: '0.875rem', padding: '0.375rem 0.875rem' }}>
              -{discount}% OFF
            </div>
          )}
          {product.images && product.images.length > 0 ? (
            <img 
              src={product.images[0]} 
              alt={product.name} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '5rem' }}>🧵</span>
              <span style={{ fontSize: '1rem', color: 'rgba(0,0,0,0.4)', fontWeight: 500 }}>
                {product.attributes?.fabricType || 'Premium Fabric'}
              </span>
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {product.category && (
            <Link
              href={`/products?categoryId=${product.category.id}`}
              style={{
                display: 'inline-block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                textDecoration: 'none',
                marginBottom: '0.75rem',
              }}
            >
              {product.category.name}
            </Link>
          )}

          <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem', lineHeight: 1.3 }}>
            {product.name}
          </h1>

          {/* Price */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text)' }}>
              Rs. {Number(product.price).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
            </span>
            {product.compareAtPrice && (
              <span style={{ fontSize: '1.125rem', color: 'var(--color-text-light)', textDecoration: 'line-through' }}>
                Rs. {Number(product.compareAtPrice).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </span>
            )}
            {discount > 0 && (
              <span className="badge badge-success" style={{ fontSize: '0.8125rem' }}>Save {discount}%</span>
            )}
          </div>

          {/* Description (Top Section) */}
          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: '2rem', fontSize: '0.9375rem' }}>
            {product.description || fullDescription}
          </p>

          {/* Attributes */}
          {product.attributes && Object.keys(product.attributes).length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '1rem', color: 'var(--color-text)' }}>
                SPECIFICATIONS
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {Object.entries(product.attributes).map(([key, value]) => (
                  <div 
                    key={key}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 1rem', 
                      backgroundColor: 'var(--clr-surface-2)',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    {key.toLowerCase() === 'color' ? (
                      <select 
                        defaultValue={String(value)}
                        style={{
                          padding: '0.25rem 1.5rem 0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--clr-surface)',
                          fontSize: '0.875rem',
                          color: 'var(--color-text)',
                          fontWeight: 500,
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        {Array.from(new Set([String(value), 'Black', 'White', 'Navy Blue', 'Charcoal Gray'])).slice(0, 5).map(color => (
                          <option key={color} value={color}>{color}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontWeight: 500 }}>{value as React.ReactNode}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SKU */}
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginBottom: '1rem' }}>
            SKU: {product.sku}
          </p>

          {/* Stock */}
          <div style={{ marginBottom: '1.5rem' }}>
            {product.stockQuantity > 10 ? (
              <span className="badge badge-success">✓ In Stock ({product.stockQuantity} available)</span>
            ) : product.stockQuantity > 0 ? (
              <span className="badge badge-warning">⚠ Only {product.stockQuantity} left</span>
            ) : (
              <span className="badge badge-danger">✕ Out of Stock</span>
            )}
          </div>

          {/* Add to Cart */}
          {product.stockQuantity > 0 && (
            <div className="product-actions-row">
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--color-border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  style={{ padding: '0.625rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 600 }}
                >
                  −
                </button>
                <span style={{ padding: '0.625rem 1rem', minWidth: '3rem', textAlign: 'center', fontSize: '0.9375rem', fontWeight: 500, borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(Math.min(product.stockQuantity, quantity + 1))}
                  style={{ padding: '0.625rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 600 }}
                >
                  +
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                className={`btn btn-lg btn-add-cart ${added ? 'btn-secondary' : 'btn-primary'}`}
              >
                {added ? '✓ Added to Cart!' : 'Add to Cart'}
              </button>
              <button
                onClick={() => toggleItem(product)}
                aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '3.25rem',
                  height: '3.25rem',
                  borderRadius: '0.5rem',
                  border: isSaved ? '1.5px solid var(--clr-brand)' : '1.5px solid var(--color-border)',
                  background: isSaved ? 'var(--clr-brand-tint, rgba(var(--clr-brand-rgb), 0.08))' : 'none',
                  color: isSaved ? 'var(--clr-brand)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--clr-brand)';
                  if (!isSaved) {
                    (e.currentTarget as HTMLElement).style.color = 'var(--clr-brand)';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = isSaved ? 'var(--clr-brand)' : 'var(--color-border)';
                  if (!isSaved) {
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
                  }
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabbed Content Section ─────────────────────────────── */}
      <div style={{ marginTop: '3rem' }}>
        {/* Tab Headers */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '2.5rem',
          borderBottom: '1px solid var(--clr-border)',
          marginBottom: '2rem'
        }}>
          {[
            { id: 'description', label: 'Description' },
            { id: 'fit', label: 'Fit and Fabric' },
            { id: 'shipping', label: 'Shipping & Return' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: 'none',
                border: 'none',
                padding: '0 0 0.75rem 0',
                fontSize: '1.05rem',
                fontWeight: 600,
                color: activeTab === tab.id ? 'var(--clr-text)' : 'var(--clr-text-2)',
                cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid var(--clr-text)' : '2px solid transparent',
                transition: 'color 0.2s, border-color 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ maxWidth: '800px', margin: '0 auto', minHeight: '300px' }}>
          
          {/* Description Content */}
          {activeTab === 'description' && (
            <div className="animate-fade-in">
              <p
                style={{
                  fontSize: '0.9375rem',
                  lineHeight: 1.8,
                  color: 'var(--clr-text-2)',
                }}
              >
                {fullDescription}
              </p>
              
              <div
                style={{
                  marginTop: '1.5rem',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                }}
              >
                {[
                  { icon: '✂️', label: 'Expert tailoring' },
                  { icon: '🧵', label: 'Premium fabric' },
                  { icon: '🌿', label: 'Eco-conscious' },
                  { icon: '🔄', label: 'Lasting durability' },
                ].map((f) => (
                  <div
                    key={f.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: 'var(--clr-text)',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{f.icon}</span>
                    <span>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fit and Fabric Content */}
          {activeTab === 'fit' && (
            <div className="animate-fade-in">
              <p style={{ fontSize: '0.9375rem', color: 'var(--clr-text-2)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Our tailored items are designed to fit perfectly. Please refer to the size chart below to find your perfect fit. Measurements are provided in inches.
              </p>

              <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.9375rem',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <thead>
                    <tr>
                      {['Size', 'Chest', 'Length'].map((col) => (
                        <th
                          key={col}
                          style={{
                            padding: '0.75rem 1rem',
                            textAlign: 'left',
                            background: 'var(--clr-surface-2)',
                            color: 'var(--clr-text)',
                            fontWeight: 600,
                            borderBottom: '2px solid var(--clr-border)',
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SIZE_CHART.map((row) => (
                      <tr key={row.size} style={{ borderBottom: '1px solid var(--clr-border-2)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{row.size}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--clr-text-2)' }}>{row.chest}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--clr-text-2)' }}>{row.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-3)', fontStyle: 'italic' }}>
                * Product image may differ to actual due to photographic lighting
              </p>
            </div>
          )}

          {/* Shipping & Return Content */}
          {activeTab === 'shipping' && (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--clr-text)', marginBottom: '1rem' }}>
                    Shipping Policy
                  </h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <li style={{ display: 'flex', gap: '0.75rem', color: 'var(--clr-text-2)', fontSize: '0.9375rem' }}>
                      <span>•</span> <span><strong>Standard Delivery:</strong> 5–7 business days (Free over $100)</span>
                    </li>
                    <li style={{ display: 'flex', gap: '0.75rem', color: 'var(--clr-text-2)', fontSize: '0.9375rem' }}>
                      <span>•</span> <span><strong>Express Delivery:</strong> 2–3 business days ($12.00)</span>
                    </li>
                    <li style={{ display: 'flex', gap: '0.75rem', color: 'var(--clr-text-2)', fontSize: '0.9375rem' }}>
                      <span>•</span> <span><strong>Overnight Courier:</strong> Next business day ($25.00)</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--clr-text)', marginBottom: '1rem' }}>
                    Return Policy
                  </h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <li style={{ display: 'flex', gap: '0.75rem', color: 'var(--clr-text-2)', fontSize: '0.9375rem' }}>
                      <span>•</span> <span>30-day hassle-free returns on all standard items.</span>
                    </li>
                    <li style={{ display: 'flex', gap: '0.75rem', color: 'var(--clr-text-2)', fontSize: '0.9375rem' }}>
                      <span>•</span> <span>Custom/tailored orders are final sale — no returns unless defective.</span>
                    </li>
                    <li style={{ display: 'flex', gap: '0.75rem', color: 'var(--clr-text-2)', fontSize: '0.9375rem' }}>
                      <span>•</span> <span>Items must be unworn, unwashed, and in original packaging.</span>
                    </li>
                  </ul>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
