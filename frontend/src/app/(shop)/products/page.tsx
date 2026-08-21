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
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Dynamic heading based on active category/subcategory
  const getPageHeading = () => {
    if (subCategory) {
      return subCategory
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
    if (categorySlug === 'new-arrivals' || collection === 'new-arrivals') return 'New Arrivals';
    if (categorySlug === 'women') return "Women's Collection";
    if (categorySlug === 'men') return "Men's Collection";
    if (categorySlug === 'teenagers') return "Teenagers Collection";
    if (categorySlug === 'uniforms') return 'Uniforms & Workwear';
    const found = categories.find((c) => c.id === categoryId || c.slug === categorySlug);
    if (found) return found.name;
    if (search) return `Search results for "${search}"`;
    return 'Our Collection';
  };

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
    <div style={{ padding: '1.5rem 0 5rem' }}>
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 className="font-display" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 700, marginBottom: '0.25rem', letterSpacing: '-0.01em', color: '#111827' }}>
            {getPageHeading()}
          </h1>
          <p style={{ color: 'var(--clr-text-3)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            {pagination.total} articles available
          </p>
        </div>

        {/* Mobile Filter & Sort Bar (Fashion Bug Mobile Style) */}
        <div className="show-mobile" style={{ display: 'none', marginBottom: '1.25rem', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => setMobileFilterOpen(true)}
            className="btn btn-outline"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              height: '42px',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '8px',
              borderColor: '#e5e7eb',
              background: '#ffffff',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <span>Filters</span>
            {(categoryId || categorySlug || subCategory || minPrice || maxPrice || search) && (
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#CC0000' }} />
            )}
          </button>

          <div style={{ flex: 1 }}>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-');
                updateFilters({ sortBy: newSortBy, sortOrder: newSortOrder });
              }}
              style={{
                width: '100%',
                height: '42px',
                padding: '0 0.75rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#111827',
                outline: 'none',
              }}
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Name: A-Z</option>
            </select>
          </div>
        </div>

        {/* Mobile Filter Slide-Over Drawer */}
        {mobileFilterOpen && (
          <>
            <div
              onClick={() => setMobileFilterOpen(false)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(2px)', zIndex: 998,
              }}
            />
            <div
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, left: 'auto',
                width: 'min(90vw, 380px)', background: '#ffffff', zIndex: 999,
                display: 'flex', flexDirection: 'column',
                boxShadow: 'var(--shadow-xl)',
              }}
            >
              {/* Drawer Header */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '1rem 1.25rem', background: '#000000', color: '#ffffff',
                }}
              >
                <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.02em', color: '#ffffff' }}>
                  Filters & Categories
                </span>
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  style={{ color: '#ffffff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                {/* Search */}
                <form onSubmit={(e) => { handleSearch(e); setMobileFilterOpen(false); }} style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Search</label>
                  <input
                    className="input"
                    placeholder="Search in category..."
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                    style={{
                      width: '100%', padding: '0.5rem 0.75rem',
                      border: '1px solid var(--clr-border)', borderRadius: 'var(--r-sm)',
                      fontSize: '0.875rem', outline: 'none',
                    }}
                  />
                </form>

                {/* Categories */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Categories</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <button
                      onClick={() => {
                        updateFilters({ categoryId: null, category: null, sub: null, collection: null, offers: null, tier: null, period: null });
                        setMobileFilterOpen(false);
                      }}
                      style={{
                        textAlign: 'left', padding: '0.55rem 0.75rem',
                        background: (!categoryId && !categorySlug && !collection) ? '#CC0000' : 'transparent',
                        color: (!categoryId && !categorySlug && !collection) ? 'white' : 'var(--clr-text)',
                        border: 'none', borderRadius: 'var(--r-sm)', fontSize: '0.85rem',
                        fontWeight: (!categoryId && !categorySlug && !collection) ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      All Categories
                    </button>

                    <button
                      onClick={() => {
                        updateFilters({ categoryId: null, category: 'new-arrivals', sub: null, collection: 'new-arrivals' });
                        setMobileFilterOpen(false);
                      }}
                      style={{
                        textAlign: 'left', padding: '0.55rem 0.75rem',
                        background: (categorySlug === 'new-arrivals' || collection === 'new-arrivals') ? '#CC0000' : 'transparent',
                        color: (categorySlug === 'new-arrivals' || collection === 'new-arrivals') ? 'white' : 'var(--clr-text)',
                        border: 'none', borderRadius: 'var(--r-sm)', fontSize: '0.85rem',
                        fontWeight: (categorySlug === 'new-arrivals' || collection === 'new-arrivals') ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      New Arrivals
                    </button>

                    {categories.map((cat) => {
                      const isSelected = categoryId === cat.id || (categorySlug === cat.slug && categorySlug !== 'new-arrivals');
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            updateFilters({ categoryId: cat.id, category: cat.slug, sub: null, collection: null });
                            setMobileFilterOpen(false);
                          }}
                          style={{
                            textAlign: 'left', padding: '0.55rem 0.75rem',
                            background: isSelected ? '#CC0000' : 'transparent',
                            color: isSelected ? 'white' : 'var(--clr-text)',
                            border: 'none', borderRadius: 'var(--r-sm)', fontSize: '0.85rem',
                            fontWeight: isSelected ? 700 : 500, cursor: 'pointer',
                          }}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Price Range */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Price Range</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      className="input"
                      type="number"
                      placeholder="Min"
                      value={minPriceDraft}
                      onChange={(e) => setMinPriceDraft(e.target.value)}
                      style={{ width: '50%', padding: '0.5rem 0.75rem', border: '1px solid var(--clr-border)', borderRadius: 'var(--r-sm)', fontSize: '0.875rem' }}
                    />
                    <span style={{ color: 'var(--clr-text-3)' }}>—</span>
                    <input
                      className="input"
                      type="number"
                      placeholder="Max"
                      value={maxPriceDraft}
                      onChange={(e) => setMaxPriceDraft(e.target.value)}
                      style={{ width: '50%', padding: '0.5rem 0.75rem', border: '1px solid var(--clr-border)', borderRadius: 'var(--r-sm)', fontSize: '0.875rem' }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      updateFilters({ minPrice: minPriceDraft, maxPrice: maxPriceDraft });
                      setMobileFilterOpen(false);
                    }}
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  >
                    Apply Price Filter
                  </button>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #f3f4f6', background: '#f9fafb', display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => {
                    updateFilters({ categoryId: null, category: null, sub: null, collection: null, minPrice: null, maxPrice: null, search: null });
                    setSearchDraft('');
                    setMinPriceDraft('');
                    setMaxPriceDraft('');
                    setMobileFilterOpen(false);
                  }}
                  className="btn btn-outline"
                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem' }}
                >
                  Clear All
                </button>
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  className="btn btn-brand"
                  style={{ flex: 2, justifyContent: 'center', fontSize: '0.8125rem', background: '#CC0000' }}
                >
                  View ({pagination.total}) Products
                </button>
              </div>
            </div>
          </>
        )}

        <div className="products-layout">
          {/* Desktop Sidebar Filters */}
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
          <div className="products-content" style={{ flex: 1, minWidth: 0 }}>
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
                  <div className="mt-14 flex flex-wrap items-center justify-center gap-2">
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
      <div className="container" style={{ paddingTop: '5rem', paddingBottom: '5rem' }}>
        <div className="flex flex-col gap-6 md:flex-row md:gap-10">
          <div className="skeleton-product-card w-full md:w-60" />
          <div className="skeleton-product-card flex-1" />
        </div>
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}
