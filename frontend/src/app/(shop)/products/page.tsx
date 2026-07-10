'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Product, Category } from '@/types';
import ProductCard from '@/components/products/ProductCard';
import ViewAsToolbar, { ViewMode } from '@/components/products/ViewAsToolbar';

function ProductsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read URL search parameters directly (source of truth)
  const search = searchParams.get('search') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const categorySlug = searchParams.get('category') || '';
  const subCategory = searchParams.get('sub') || '';
  const collection = searchParams.get('collection') || '';
  const offers = searchParams.get('offers') || '';
  const tier = searchParams.get('tier') || '';
  const period = searchParams.get('period') || '';
  const sortParam = searchParams.get('sort') || '';
  const sortBy = searchParams.get('sortBy') || (sortParam === 'newest' ? 'createdAt' : sortParam === 'trending' ? 'trending' : 'createdAt');
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const pageParam = searchParams.get('page') || '1';
  const page = parseInt(pageParam, 10) || 1;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // View mode state with local storage persistence
  const [viewMode, setViewMode] = useState<ViewMode>('grid-4');

  useEffect(() => {
    const saved = localStorage.getItem('nandana_view_mode') as ViewMode;
    if (saved && ['grid-2', 'grid-3', 'grid-4', 'list'].includes(saved)) {
      setViewMode(saved);
    }
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('nandana_view_mode', mode);
  };

  // Draft local state for inputs so typing doesn't trigger API requests immediately
  const [searchDraft, setSearchDraft] = useState(search);
  const [minPriceDraft, setMinPriceDraft] = useState(minPrice);
  const [maxPriceDraft, setMaxPriceDraft] = useState(maxPrice);

  // Sync draft states when URL changes
  useEffect(() => { setSearchDraft(search); }, [search]);
  useEffect(() => { setMinPriceDraft(minPrice); }, [minPrice]);
  useEffect(() => { setMaxPriceDraft(maxPrice); }, [maxPrice]);

  // Load categories on mount
  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
  }, []);

  // Fetch products whenever any URL query parameter changes
  useEffect(() => {
    let active = true;
    setLoading(true);

    api.getProducts({
      page,
      limit: 12,
      search: search || undefined,
      categoryId: categoryId || undefined,
      categorySlug: categorySlug || undefined,
      subCategory: subCategory || undefined,
      collection: collection || (categorySlug === 'new-arrivals' ? 'new-arrivals' : undefined),
      offers: offers || (subCategory === 'special-offers' ? '1' : undefined),
      tier: tier || (subCategory === 'premium-collection' ? 'premium' : undefined),
      period: period || (subCategory === 'latest-this-week' ? 'week' : undefined),
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sortBy,
      sortOrder,
    }).then((res) => {
      if (active) {
        setProducts(res.products || []);
        setPagination(res.pagination);
        setLoading(false);
      }
    }).catch((err) => {
      console.error('Failed to load products:', err);
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [page, search, categoryId, categorySlug, subCategory, collection, offers, tier, period, sortParam, minPrice, maxPrice, sortBy, sortOrder]);

  // Push new parameters to URL
  const updateFilters = (newParams: Record<string, string | number | null | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    // Reset page to 1 when filters change (unless updating page itself)
    if (!('page' in newParams)) {
      params.delete('page');
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchDraft });
  };

  return (
    <div style={{ padding: '2.5rem 0 5rem' }}>
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 className="font-display" style={{ fontSize: '2.25rem', fontWeight: 600, marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>
            Our Collection
          </h1>
          <p style={{ color: 'var(--clr-text-3)', fontSize: '0.9rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            Browse through our premium, curated fashion articles
          </p>
        </div>

        <div className="products-layout">
          {/* Sidebar Filters */}
          <aside className="products-sidebar">
            {/* Search */}
            <form onSubmit={handleSearch} style={{ marginBottom: '1.75rem' }}>
              <label className="input-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem' }}>Search</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="input"
                  placeholder="Search products..."
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid var(--clr-border)',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'border-color 150ms ease',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--clr-brand)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--clr-border)'}
                />
              </div>
            </form>

            {/* Categories */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label className="input-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem' }}>Categories</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <button
                  onClick={() => updateFilters({ categoryId: null, category: null, sub: null, collection: null, offers: null, tier: null, period: null })}
                  style={{
                    textAlign: 'left',
                    padding: '0.5rem 0.75rem',
                    background: (!categoryId && !categorySlug && !collection) ? 'var(--clr-brand)' : 'transparent',
                    color: (!categoryId && !categorySlug && !collection) ? 'white' : 'var(--clr-text)',
                    border: 'none',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '0.85rem',
                    fontWeight: (!categoryId && !categorySlug && !collection) ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={(e) => { if (categoryId || categorySlug || collection) e.currentTarget.style.background = 'var(--clr-brand-tint)'; }}
                  onMouseLeave={(e) => { if (categoryId || categorySlug || collection) e.currentTarget.style.background = 'transparent'; }}
                >
                  All Categories
                </button>

                {/* New Arrivals Category item */}
                <button
                  onClick={() => updateFilters({ categoryId: null, category: 'new-arrivals', sub: null, collection: 'new-arrivals' })}
                  style={{
                    textAlign: 'left',
                    padding: '0.5rem 0.75rem',
                    background: (categorySlug === 'new-arrivals' || collection === 'new-arrivals') ? 'var(--clr-brand)' : 'transparent',
                    color: (categorySlug === 'new-arrivals' || collection === 'new-arrivals') ? 'white' : 'var(--clr-text)',
                    border: 'none',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '0.85rem',
                    fontWeight: (categorySlug === 'new-arrivals' || collection === 'new-arrivals') ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={(e) => { if (categorySlug !== 'new-arrivals' && collection !== 'new-arrivals') e.currentTarget.style.background = 'var(--clr-brand-tint)'; }}
                  onMouseLeave={(e) => { if (categorySlug !== 'new-arrivals' && collection !== 'new-arrivals') e.currentTarget.style.background = 'transparent'; }}
                >
                  New Arrivals
                </button>

                {categories.map((cat) => {
                  const isSelected = categoryId === cat.id || (categorySlug === cat.slug && categorySlug !== 'new-arrivals');
                  return (
                    <button
                      key={cat.id}
                      onClick={() => updateFilters({ categoryId: cat.id, category: cat.slug, sub: null, collection: null })}
                      style={{
                        textAlign: 'left',
                        padding: '0.5rem 0.75rem',
                        background: isSelected ? 'var(--clr-brand)' : 'transparent',
                        color: isSelected ? 'white' : 'var(--clr-text)',
                        border: 'none',
                        borderRadius: 'var(--r-sm)',
                        fontSize: '0.85rem',
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--clr-brand-tint)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label className="input-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem' }}>Price Range</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  className="input"
                  type="number"
                  placeholder="Min"
                  value={minPriceDraft}
                  onChange={(e) => setMinPriceDraft(e.target.value)}
                  style={{
                    width: '50%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid var(--clr-border)',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
                <span style={{ color: 'var(--clr-text-3)' }}>—</span>
                <input
                  className="input"
                  type="number"
                  placeholder="Max"
                  value={maxPriceDraft}
                  onChange={(e) => setMaxPriceDraft(e.target.value)}
                  style={{
                    width: '50%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid var(--clr-border)',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={() => updateFilters({ minPrice: minPriceDraft, maxPrice: maxPriceDraft })}
                className="btn btn-outline btn-sm"
                style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
              >
                Apply Price Filter
              </button>
            </div>

            {/* Sort */}
            <div>
              <label className="input-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem' }}>Sort By</label>
              <select
                className="input"
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split('-');
                  updateFilters({ sortBy: newSortBy, sortOrder: newSortOrder });
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid var(--clr-border)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  background: '#fff',
                }}
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Name: A-Z</option>
                <option value="name-desc">Name: Z-A</option>
              </select>
            </div>
          </aside>

          {/* Product Grid Container */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Results toolbar: count, view as switcher, and active filter tags */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--clr-text-2)', fontFamily: 'var(--font-mono)', margin: 0 }}>
                  {pagination.total} products found
                </p>
                <ViewAsToolbar currentMode={viewMode} onModeChange={handleViewModeChange} />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {(categorySlug === 'new-arrivals' || collection === 'new-arrivals') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', background: 'var(--clr-brand-tint)', border: '1px solid var(--clr-brand)', borderRadius: 'var(--r-full)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--clr-brand)' }}>
                    Category: New Arrivals
                    <button onClick={() => updateFilters({ category: null, collection: null, sub: null })} style={{ display: 'inline-flex', alignSelf: 'center', cursor: 'pointer', fontWeight: 700, paddingLeft: '0.25rem', border: 'none', background: 'none', color: 'var(--clr-brand)' }}>×</button>
                  </div>
                )}
                {subCategory && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', background: 'var(--clr-brand-tint)', border: '1px solid var(--clr-brand)', borderRadius: 'var(--r-full)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--clr-brand)', textTransform: 'capitalize' }}>
                    Subcategory: {subCategory.replace(/-/g, ' ')}
                    <button onClick={() => updateFilters({ sub: null, offers: null, tier: null, period: null })} style={{ display: 'inline-flex', alignSelf: 'center', cursor: 'pointer', fontWeight: 700, paddingLeft: '0.25rem', border: 'none', background: 'none', color: 'var(--clr-brand)' }}>×</button>
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className={`product-grid ${viewMode} animate-fade-in`}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="skeleton-product-card">
                    <div className="skeleton-image" />
                    <div className="skeleton-info">
                      <div className="skeleton-line tag" />
                      <div className="skeleton-line title-1" />
                      <div className="skeleton-line title-2" />
                      <div className="skeleton-line price" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', background: 'var(--clr-surface-2)', borderRadius: 'var(--r-md)', border: '1px dashed var(--clr-border)' }}>
                <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔍</p>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--clr-text)' }}>No products found</h3>
                <p style={{ color: 'var(--clr-text-3)', fontSize: '0.85rem' }}>Try adjusting your filters or search terms</p>
              </div>
            ) : (
              <>
                <div className={`product-grid ${viewMode} animate-fade-in`}>
                  {products.map((product, idx) => (
                    <ProductCard key={product.id} product={product} index={idx} />
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '3.5rem' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={page <= 1}
                      onClick={() => updateFilters({ page: page - 1 })}
                      style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                      Previous
                    </button>
                    {Array.from({ length: pagination.totalPages }, (_, i) => (
                      <button
                        key={i + 1}
                        className={`btn btn-sm ${page === i + 1 ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => updateFilters({ page: i + 1 })}
                        style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={page >= pagination.totalPages}
                      onClick={() => updateFilters({ page: page + 1 })}
                      style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="container" style={{ padding: '5rem 0' }}>
        <div style={{ display: 'flex', gap: '2.5rem' }}>
          <div style={{ width: '240px' }} className="skeleton-product-card" />
          <div style={{ flex: 1 }} className="skeleton-product-card" />
        </div>
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}
