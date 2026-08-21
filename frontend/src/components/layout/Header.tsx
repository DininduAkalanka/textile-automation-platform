'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';
import { useModalStore } from '@/store/useModalStore';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { BrandMark } from '@/components/brand/brand-mark';
import { CategoryMegaNav, CATEGORIES_DATA } from '@/components/layout/CategoryMegaNav';

/* ── SVG Icon Components ──────────────────────────────────── */
const IconSearch = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);
const IconCart = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
const IconUser = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconMenu = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6"  x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="15" y2="18"/>
  </svg>
);
const IconClose = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6"  x2="6"  y2="18"/>
    <line x1="6"  y1="6"  x2="18" y2="18"/>
  </svg>
);
const IconChevronDown = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);
const IconChevronRight = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);
const IconArrowRight = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
);
const IconHeart = ({ size = 19, filled = false }: { size?: number; filled?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
  </svg>
);

/* ── Navigation data ──────────────────────────────────────── */
const NAV = [
  { label: 'Home', href: '/' },
  {
    label: 'New Arrivals',
    href: '/products?category=new-arrivals',
    dropdown: [
      { label: 'Latest This Week',   href: '/products?category=new-arrivals&sub=latest-this-week' },
      { label: 'Trending Now',       href: '/products?category=new-arrivals&sub=trending-now' },
      { label: 'Premium Collection', href: '/products?category=new-arrivals&sub=premium-collection' },
      { label: 'Special Offers',     href: '/products?category=new-arrivals&sub=special-offers' },
    ],
  },
  {
    label: 'Women',
    href: '/products?category=women',
    dropdown: [
      { label: 'Dress Materials',  href: '/products?category=women&sub=dress-materials' },
      { label: 'Sarees',           href: '/products?category=women&sub=sarees' },
      { label: 'Blouses',          href: '/products?category=women&sub=blouses' },
      { label: 'Kurthas',          href: '/products?category=women&sub=kurthas' },
      { label: 'Evening Wear',     href: '/products?category=women&sub=evening' },
      { label: 'Casual Wear',      href: '/products?category=women&sub=casual' },
    ],
  },
  {
    label: 'Men',
    href: '/products?category=men',
    dropdown: [
      { label: 'Formal Shirts',    href: '/products?category=men&sub=shirts' },
      { label: 'Trousers',         href: '/products?category=men&sub=trousers' },
      { label: 'Sarongs',          href: '/products?category=men&sub=sarongs' },
      { label: 'Casual Wear',      href: '/products?category=men&sub=casual' },
      { label: 'Sports & Active',  href: '/products?category=men&sub=sports' },
    ],
  },
  {
    label: 'Teenagers',
    href: '/products?category=teenagers',
    dropdown: [
      { label: 'Casual & Trendy',  href: '/products?category=teenagers&sub=casual' },
      { label: 'Street Style',     href: '/products?category=teenagers&sub=street' },
      { label: 'Sportswear',       href: '/products?category=teenagers&sub=sports' },
      { label: 'School Ready',     href: '/products?category=teenagers&sub=school-ready' },
    ],
  },
  {
    label: 'Uniforms',
    href: '/products?category=uniforms',
    isMega: true,
    megaCols: [
      {
        title: 'School Uniforms',
        viewAll: '/products?category=uniforms&sub=school-all',
        links: [
          { label: 'Government School Uniforms', href: '/products?category=uniforms&sub=government-school', note: 'Standard approved' },
          { label: 'Private School Uniforms',    href: '/products?category=uniforms&sub=private-school',    note: 'Premium quality' },
        ],
      },
      {
        title: 'Office Uniforms',
        viewAll: '/products?category=uniforms&sub=office-all',
        links: [
          { label: 'Corporate Formal Wear',      href: '/products?category=uniforms&sub=corporate',   note: 'Professional attire' },
          { label: 'Workwear & Industrial',       href: '/products?category=uniforms&sub=industrial',  note: 'Durable fabrics' },
          { label: 'Healthcare Uniforms',         href: '/products?category=uniforms&sub=healthcare',  note: 'Medical & clinic' },
        ],
      },
    ],
  },
];

/* ── Nav Link Component ───────────────────────────────────── */
function NavLink({ item }: { item: typeof NAV[0] }) {
  return (
    <div className="nav-item" style={{ position: 'relative' }}>
      <Link
        href={item.href}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.5rem 0.625rem',
          fontSize: '0.8rem',
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--clr-text)',
          fontFamily: 'var(--font-sans)',
          transition: 'color 150ms ease',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--clr-brand)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--clr-text)')}
      >
        {item.label}
        {'dropdown' in item || 'isMega' in item
          ? <IconChevronDown size={11} />
          : null}
      </Link>

      {/* Standard Dropdown */}
      {'dropdown' in item && item.dropdown && (
        <div className="dropdown-panel" style={{ minWidth: '210px' }}>
          {'dropdown' in item && (item as { dropdown: { label: string; href: string }[] }).dropdown.map(link => (
            <Link key={link.label} href={link.href} className="dropdown-item">
              <span className="dropdown-item-dot" />
              {link.label}
            </Link>
          ))}
        </div>
      )}

      {/* Uniforms Mega Panel */}
      {'isMega' in item && item.isMega && 'megaCols' in item && item.megaCols && (
        <div className="mega-panel"
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.opacity = '1';
            (e.currentTarget as HTMLElement).style.visibility = 'visible';
            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLElement).style.pointerEvents = 'all';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.opacity = '';
            (e.currentTarget as HTMLElement).style.visibility = '';
            (e.currentTarget as HTMLElement).style.transform = '';
            (e.currentTarget as HTMLElement).style.pointerEvents = '';
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {(item as { megaCols: { title: string; viewAll: string; links: { label: string; href: string; note: string }[] }[] }).megaCols.map(col => (
              <div key={col.title}>
                <span className="mega-col-label">{col.title}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                  {col.links.map(link => (
                    <Link
                      key={link.label}
                      href={link.href}
                      style={{
                        display: 'block',
                        padding: '0.625rem 0.75rem',
                        borderRadius: 'var(--r-sm)',
                        transition: 'background 150ms ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--clr-brand-tint)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--clr-text)', lineHeight: 1.3 }}>
                        {link.label}
                      </div>
                      <div style={{ fontSize: '0.71rem', color: 'var(--clr-text-3)', marginTop: '0.15rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                        {link.note}
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  href={col.viewAll}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    marginTop: '0.875rem',
                    padding: '0 0.75rem',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--clr-brand)',
                    fontFamily: 'var(--font-mono)',
                    transition: 'gap 150ms ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.gap = '0.625rem')}
                  onMouseLeave={e => (e.currentTarget.style.gap = '0.375rem')}
                >
                  View All <IconArrowRight size={12} />
                </Link>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--clr-border-2)' }}>
            <Link
              href="/products?category=uniforms"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.07em',
                textTransform: 'uppercase', color: 'var(--clr-text-2)',
                fontFamily: 'var(--font-mono)',
                transition: 'color 150ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--clr-brand)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--clr-text-2)')}
            >
              Browse all uniform categories <IconArrowRight />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Export ──────────────────────────────────────────── */
export default function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const items           = useCartStore(s => s.items) || [];
  const cartCount       = items.length;
  const wishlistCount   = useWishlistStore(s => s.items.length);
  const openVisualSearch = useModalStore(s => s.openVisualSearch);

  const [scrolled,        setScrolled]        = useState(false);
  const [mobileOpen,      setMobileOpen]      = useState(false);
  const [profileOpen,     setProfileOpen]      = useState(false);
  const [searchOpen,      setSearchOpen]      = useState(false);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [mobileExpanded,  setMobileExpanded]  = useState<string | null>(null);
  const [mounted,         setMounted]         = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 60);
  }, [searchOpen]);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    setMobileExpanded(null);
  }, []);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (mobileOpen || searchOpen) {
      document.body.style.overflow = 'hidden';
      // Prevent iOS body scroll bounce
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => { 
      document.body.style.overflow = ''; 
      document.documentElement.style.overflow = '';
    };
  }, [mobileOpen, searchOpen]);

  return (
    <>
      {/* ── Announcement Bar ─────────────────────────────── */}
      <div
        style={{
          background: 'var(--obsidian-950)',
          color: 'var(--clr-text-inv-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6875rem',
          fontWeight: 400,
          letterSpacing: '0.1em',
          textAlign: 'center',
          padding: '0.5rem 1rem',
          lineHeight: 1.4,
        }}
      >
        <span>Free island-wide delivery on orders above&nbsp;</span>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>Rs. 5,000</span>
        <span style={{ margin: '0 1rem', opacity: 0.3 }}>|</span>
        <span>Use code&nbsp;</span>
        <span style={{ color: 'var(--gold-400)', fontWeight: 500 }}>NANDANA20</span>
        <span>&nbsp;for 20% off your first order</span>
      </div>

      {/* ── Main Header ──────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 300,
          background: scrolled ? 'rgba(255,255,255,0.97)' : '#fff',
          borderBottom: '1px solid var(--clr-border)',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
          boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
          transition: 'box-shadow 240ms ease, backdrop-filter 240ms ease',
        }}
      >
        <div className="container" style={{ display: 'flex', alignItems: 'center', height: '64px', gap: 'clamp(0.25rem, 2.5vw, 1rem)' }}>

          {/* Mobile hamburger */}
          <button
            id="mobile-menu-btn"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            className="show-mobile btn-icon"
            style={{ flexShrink: 0, marginRight: '0.25rem' }}
          >
            <IconMenu />
          </button>

          {/* ── Logo ─────────────────────────────────────── */}
          <Link
            href="/"
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, textDecoration: 'none' }}
          >
            {/* Woven NT monogram */}
            <BrandMark size={38} style={{ flexShrink: 0 }} />
            {/* Logotype */}
            <div className="hide-mobile" style={{ lineHeight: 1 }}>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.3rem',
                  fontWeight: 600,
                  color: 'var(--clr-text)',
                  letterSpacing: '0.01em',
                  lineHeight: 1.1,
                }}
              >
                Nandana
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.52rem',
                  fontWeight: 400,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--clr-brand)',
                  marginTop: '1px',
                }}
              >
                Textile
              </div>
            </div>
          </Link>

          {/* ── Center Search Bar ────────────────────────── */}
          <div className="hide-mobile" style={{ flex: 1, maxWidth: '480px', margin: '0 auto' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = searchQuery.trim();
                if (q) window.location.href = `/products?search=${encodeURIComponent(q)}`;
              }}
              style={{ position: 'relative', width: '100%' }}
            >
              <input
                type="text"
                placeholder="Search fabrics, sarees, uniforms, shirts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 38px 0 16px',
                  fontSize: '0.84rem',
                  border: '1.5px solid var(--clr-border)',
                  borderRadius: '20px',
                  outline: 'none',
                  background: '#f9fafb',
                  transition: 'all 200ms ease',
                  fontFamily: 'var(--font-sans)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#CC0000';
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--clr-border)';
                  e.currentTarget.style.background = '#f9fafb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                type="submit"
                aria-label="Submit search"
                style={{
                  position: 'absolute',
                  right: '5px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#CC0000',
                  color: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#990000'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#CC0000'}
              >
                <IconSearch size={13} />
              </button>
            </form>
          </div>

          {/* ── Actions ──────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
            {/* LKR Currency Indicator */}
            <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.725rem', fontWeight: 600, color: 'var(--clr-text-2)', padding: '0.3rem 0.6rem', background: '#f3f4f6', borderRadius: '14px', marginRight: '0.25rem' }}>
              <span>🇱🇰</span>
              <span>LKR</span>
            </div>

            {/* Visual Search button */}
            <button
              id="search-btn"
              aria-label="Search"
              className="btn-icon"
              onClick={() => setSearchOpen(true)}
              title="Quick Search & AI Lens"
            >
              <IconSearch size={17} />
            </button>

            {/* Wishlist */}
            <Link
              href="/wishlist"
              id="wishlist-btn"
              aria-label="Wishlist"
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.5rem',
                height: '2.5rem',
                color: mounted && wishlistCount > 0 ? 'var(--clr-brand)' : 'var(--clr-text-2)',
                borderRadius: 'var(--r-sm)',
                transition: 'color 150ms ease, background 150ms ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--clr-brand)';
                (e.currentTarget as HTMLElement).style.background = 'var(--clr-brand-tint)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = mounted && wishlistCount > 0 ? 'var(--clr-brand)' : 'var(--clr-text-2)';
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <IconHeart size={19} filled={mounted && wishlistCount > 0} />
              {mounted && wishlistCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'var(--clr-brand)',
                    color: '#fff',
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid #fff',
                  }}
                >
                  {wishlistCount > 9 ? '9+' : wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart */}
            <Link
              href="/cart"
              id="cart-btn"
              aria-label="Shopping bag"
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.5rem',
                height: '2.5rem',
                color: 'var(--clr-text-2)',
                borderRadius: 'var(--r-sm)',
                transition: 'color 150ms ease, background 150ms ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--clr-brand)';
                (e.currentTarget as HTMLElement).style.background = 'var(--clr-brand-tint)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--clr-text-2)';
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <IconCart size={19} />
              {mounted && cartCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'var(--clr-brand)',
                    color: '#fff',
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid #fff',
                  }}
                >
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>

            {/* Notifications (plan 7.1 task 4). mounted-gated the same way the
                profile button below is — rendering it before hydration would
                show a bell that can never possibly be right. */}
            {mounted && isAuthenticated && (
              <NotificationBell signedIn={isAuthenticated} />
            )}

            {/* Auth — separator line */}
            <div
              className="hide-mobile"
              style={{ width: '1px', height: '18px', background: 'var(--clr-border)', margin: '0 0.5rem', flexShrink: 0 }}
            />

            {/* Auth */}
            {mounted && (
              isAuthenticated ? (
                <div style={{ position: 'relative' }}>
                  <button
                    id="profile-btn"
                    aria-label="Account"
                    onClick={() => setProfileOpen(p => !p)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.375rem 0.75rem',
                      border: '1px solid var(--clr-border)',
                      borderRadius: 'var(--r-sm)',
                      background: 'transparent',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--clr-brand)'; }}
                    onMouseLeave={e => { if (!profileOpen) (e.currentTarget as HTMLElement).style.borderColor = 'var(--clr-border)'; }}
                  >
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: 'var(--clr-brand)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                    <span
                      className="hide-tablet"
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        color: 'var(--clr-text)',
                      }}
                    >
                      {user?.firstName}
                    </span>
                    <IconChevronDown size={11} />
                  </button>

                  {profileOpen && (
                    <>
                      <div onClick={() => setProfileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          right: 0,
                          background: '#fff',
                          border: '1px solid var(--clr-border)',
                          borderRadius: 'var(--r-md)',
                          boxShadow: 'var(--shadow-lg)',
                          padding: '0.375rem',
                          minWidth: '200px',
                          zIndex: 99,
                          animation: 'fadeInDown 0.2s var(--ease-out-expo)',
                        }}
                      >
                        <div
                          style={{
                            padding: '0.625rem 0.75rem 0.75rem',
                            borderBottom: '1px solid var(--clr-border-2)',
                            marginBottom: '0.25rem',
                          }}
                        >
                          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--clr-text)' }}>
                            {user?.firstName} {user?.lastName}
                          </p>
                          <p style={{ fontSize: '0.72rem', color: 'var(--clr-text-3)', fontFamily: 'var(--font-mono)', marginTop: '0.1rem' }}>
                            {user?.email}
                          </p>
                        </div>

                        {[
                          { label: 'My Orders', href: '/account/orders' },
                          ...(user?.role === 'ADMIN' ? [{ label: 'Admin Dashboard', href: '/admin' }] : []),
                        ].map(link => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setProfileOpen(false)}
                            className="dropdown-item"
                          >
                            <span className="dropdown-item-dot" />
                            {link.label}
                          </Link>
                        ))}

                        <div style={{ height: '1px', background: 'var(--clr-border-2)', margin: '0.25rem 0.75rem' }} />
                        <button
                          onClick={() => { logout(); setProfileOpen(false); }}
                          style={{
                            display: 'flex',
                            width: '100%',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            color: 'var(--clr-brand)',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: 'var(--r-sm)',
                            transition: 'background 150ms ease',
                            textAlign: 'left',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--crimson-50)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Link href="/login" id="login-btn" className="btn btn-outline btn-sm">
                    Sign In
                  </Link>
                  <Link href="/register" id="register-btn" className="btn btn-brand btn-sm">
                    Register
                  </Link>
                </div>
              )
            )}

            {/* Mobile auth icon */}
            {mounted && !isAuthenticated && (
              <Link href="/login" className="show-mobile btn-icon" aria-label="Sign in">
                <IconUser size={18} />
              </Link>
            )}
          </div>
        </div>

        {/* Thin brand accent line */}
        <div style={{ height: '2px', background: 'var(--clr-brand)', opacity: 0.9 }} />
        {/* ── Signature Red Category Navigation Bar (Fashion Bug Style) ── */}
        <CategoryMegaNav />
      </header>

      {/* ── Search Overlay ────────────────────────────────── */}
      {searchOpen && (
        <>
          <div
            onClick={() => setSearchOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(3px)', zIndex: 490,
              animation: 'fadeIn 0.2s ease',
            }}
          />
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0,
              background: '#fff', borderBottom: '1px solid var(--clr-border)',
              padding: '1.25rem 1rem 1.5rem', zIndex: 495,
              boxShadow: 'var(--shadow-lg)', animation: 'slideDown 0.2s ease',
            }}
          >
            <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem', border: '1.5px solid var(--clr-brand)',
                  borderRadius: 'var(--r-md)', background: 'var(--warm-50)',
                }}
              >
                <IconSearch size={18} />
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Search products, fabrics, uniforms, sarees..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      setSearchOpen(false);
                      window.location.href = `/products?search=${encodeURIComponent(searchQuery.trim())}`;
                    }
                  }}
                  style={{
                    flex: 1, border: 'none', outline: 'none', fontSize: '0.9375rem',
                    color: 'var(--clr-text)', background: 'transparent', fontFamily: 'var(--font-sans)',
                  }}
                />
                {/* Visual Search shortcut */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setSearchOpen(false);
                    openVisualSearch();
                  }}
                  title="Search by image (AI Visual Search)"
                  style={{
                    color: 'var(--clr-text-3)', background: 'transparent',
                    border: 'none', cursor: 'pointer', padding: '2px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'color 150ms ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--clr-brand)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--clr-text-3)'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setSearchOpen(false)}
                className="btn-icon"
                aria-label="Close search"
                style={{ flexShrink: 0, color: 'var(--clr-text-2)' }}
              >
                <IconClose size={18} />
              </button>
            </div>
            <p
              style={{
                maxWidth: '680px', margin: '0.625rem auto 0', paddingLeft: '1.75rem',
                fontSize: '0.72rem', color: 'var(--clr-text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
              }}
            >
              Press Escape to close &mdash; suggestions appear as you type
            </p>
          </div>
        </>
      )}

      {/* ── Mobile Overlay ────────────────────────────────── */}
      <div
        onClick={closeMobile}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(2px)', zIndex: 490,
          opacity: mobileOpen ? 1 : 0, visibility: mobileOpen ? 'visible' : 'hidden',
          transition: 'opacity 0.4s ease, visibility 0.4s',
          pointerEvents: mobileOpen ? 'all' : 'none',
        }}
      />

      {/* ── Mobile Drawer (Fashion Bug Mobile Style) ─────────── */}
      <div
        id="mobile-drawer"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, left: 'auto',
          width: 'min(88vw, 360px)', background: '#ffffff', zIndex: 491,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)', overflowY: 'auto',
        }}
      >
        {/* Drawer Header (Pure Black with Menu Title & Close) */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.25rem', background: '#000000', color: '#ffffff',
          }}
        >
          <span style={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '0.02em', color: '#ffffff' }}>
            Menu
          </span>
          <button
            onClick={closeMobile}
            className="btn-icon"
            aria-label="Close menu"
            style={{ color: '#ffffff', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* Drawer Nav (Categories with Circular Thumbnails & Chevron) */}
        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {CATEGORIES_DATA.map(item => {
            const hasChildren = Boolean(item.columns && item.columns.length > 0);
            const isExpanded  = mobileExpanded === item.label;
            return (
              <div key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.75rem 1.25rem', cursor: 'pointer',
                    background: isExpanded ? '#f9fafb' : '#ffffff',
                    transition: 'background 150ms ease',
                  }}
                  onClick={() => {
                    if (hasChildren) {
                      setMobileExpanded(isExpanded ? null : item.label);
                    } else {
                      closeMobile();
                      window.location.href = item.href;
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    {/* Circular Thumbnail Avatar */}
                    {item.thumbnail ? (
                      <div
                        style={{
                          width: '38px', height: '38px', borderRadius: '50%',
                          overflow: 'hidden', flexShrink: 0, position: 'relative',
                          border: '1.5px solid #f3f4f6', background: '#f9fafb',
                        }}
                      >
                        <Image
                          src={item.thumbnail}
                          alt={item.label}
                          width={38}
                          height={38}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: '38px', height: '38px', borderRadius: '50%',
                          background: '#f3f4f6', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', color: '#6b7280', fontSize: '0.8rem',
                          fontWeight: 700, flexShrink: 0,
                        }}
                      >
                        {item.label[0]}
                      </div>
                    )}

                    {/* Category Label */}
                    <span
                      style={{
                        fontSize: '0.925rem', fontWeight: 500, color: '#111827',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {item.label}
                    </span>
                  </div>

                  {/* Right Chevron */}
                  {hasChildren && (
                    <div
                      style={{
                        color: '#9ca3af',
                        transition: 'transform 200ms ease',
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                      }}
                    >
                      <IconChevronRight size={16} />
                    </div>
                  )}
                </div>

                {/* Subcategory Accordion */}
                {isExpanded && hasChildren && item.columns && (
                  <div style={{ background: '#f9fafb', padding: '0.5rem 0 0.875rem', borderTop: '1px solid #f3f4f6' }}>
                    {item.columns.map((col, cIdx) => (
                      <div key={cIdx} style={{ marginBottom: '0.875rem' }}>
                        <p style={{ padding: '0.5rem 1.5rem 0.25rem', fontSize: '0.675rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#CC0000', fontFamily: 'var(--font-sans)' }}>
                          {col.title}
                        </p>
                        {col.links.map((link, lIdx) => (
                          <Link
                            key={lIdx}
                            href={link.href}
                            onClick={closeMobile}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '0.45rem 2rem', fontSize: '0.84rem', color: '#4b5563',
                              transition: 'color 150ms ease',
                            }}
                          >
                            <span>{link.label}</span>
                            {link.note && (
                              <span style={{ fontSize: '0.65rem', color: 'var(--clr-text-3)', fontFamily: 'var(--font-mono)' }}>
                                {link.note}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Currency Switcher & Footer (Fashion Bug Style) */}
        <div style={{ padding: '1.25rem', borderTop: '1px solid #f3f4f6', background: '#f9fafb' }}>
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#111827', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
              CURRENCY
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', fontWeight: 700, color: '#111827', borderBottom: '2px solid #111827', paddingBottom: '2px', width: 'fit-content' }}>
              <span style={{ fontSize: '1.1rem' }}>🇱🇰</span>
              <span>LKR</span>
            </div>
          </div>

          {/* Quick Account / Sign In */}
          {mounted && isAuthenticated ? (
            <button
              onClick={() => { logout(); closeMobile(); }}
              className="btn btn-outline-brand"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Sign Out
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <Link href="/login"    onClick={closeMobile} className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }}>Sign In</Link>
              <Link href="/register" onClick={closeMobile} className="btn btn-brand"   style={{ flex: 1, justifyContent: 'center', background: '#CC0000' }}>Register</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
