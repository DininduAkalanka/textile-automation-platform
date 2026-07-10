import Link from 'next/link';

/* ── Social icon paths ──────────────────────────────────────── */
const SOCIAL = [
  {
    id: 'facebook',
    label: 'Facebook',
    href: '#',
    path: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
    fill: true,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    href: '#',
    path: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zM17.5 6.5h.01',
    fill: false,
    extra: '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    href: '#',
    path: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z',
    fill: true,
  },
];

/* ── Link columns ───────────────────────────────────────────── */
const COLS = [
  {
    heading: 'Shop',
    links: [
      { label: 'New Arrivals',          href: '/#latest-arrivals' },
      { label: 'Women',                 href: '/products?category=women' },
      { label: 'Men',                   href: '/products?category=men' },
      { label: 'Teenagers',             href: '/products?category=teenagers' },
      { label: 'All Products',          href: '/products' },
    ],
  },
  {
    heading: 'Uniforms',
    links: [
      { label: 'Government School Uniforms', href: '/products?category=uniforms&sub=government-school' },
      { label: 'Private School Uniforms',    href: '/products?category=uniforms&sub=private-school' },
      { label: 'Corporate Office Wear',      href: '/products?category=uniforms&sub=corporate' },
      { label: 'Workwear & Industrial',      href: '/products?category=uniforms&sub=industrial' },
      { label: 'Healthcare Uniforms',        href: '/products?category=uniforms&sub=healthcare' },
    ],
  },
  {
    heading: 'Customer Care',
    links: [
      { label: 'Track My Order',    href: '/orders' },
      { label: 'Returns & Exchange', href: '/returns-exchange' },
      { label: 'Shipping Information', href: '#' },
      { label: 'Size & Fit Guide',  href: '#' },
      { label: 'Frequently Asked',  href: '#' },
    ],
  },
];

/* ── Helper ─────────────────────────────────────────────────── */
function ColLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.8125rem',
          color: 'rgba(255,255,255,0.45)',
          textDecoration: 'none',
          lineHeight: 1.5,
          transition: 'color 150ms ease, gap 150ms ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)'; (e.currentTarget as HTMLElement).style.gap = '0.75rem'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; (e.currentTarget as HTMLElement).style.gap = '0.5rem'; }}
      >
        <span style={{ display: 'block', width: '14px', height: '1px', background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
        {label}
      </Link>
    </li>
  );
}

/* ── Footer ─────────────────────────────────────────────────── */
export default function Footer() {
  return (
    <footer style={{ background: 'var(--obsidian-950)', color: 'rgba(255,255,255,0.45)' }}>

      {/* ── Newsletter ────────────────────────────────────── */}
      <div
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '3rem 0',
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '2.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                fontWeight: 400,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--clr-brand)',
                marginBottom: '0.625rem',
              }}
            >
              Newsletter
            </p>
            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.5rem',
                fontWeight: 600,
                color: '#fff',
                lineHeight: 1.2,
              }}
            >
              Stay Updated with Nandana Textile
            </h3>
            <p style={{ fontSize: '0.8125rem', marginTop: '0.375rem', lineHeight: 1.65 }}>
              New arrivals, school season alerts, and exclusive offers delivered to your inbox.
            </p>
          </div>
          <form
            onSubmit={e => e.preventDefault()}
            style={{ display: 'flex', gap: '0', flexShrink: 0 }}
          >
            <input
              type="email"
              id="newsletter-email"
              placeholder="Your email address"
              style={{
                padding: '0.75rem 1.125rem',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRight: 'none',
                color: '#fff',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                width: '280px',
                borderRadius: 'var(--r-xs) 0 0 var(--r-xs)',
              }}
            />
            <button
              type="submit"
              className="btn btn-brand"
              style={{ borderRadius: '0 var(--r-xs) var(--r-xs) 0' }}
            >
              Subscribe
            </button>
          </form>
        </div>
      </div>

      {/* ── Main links ────────────────────────────────────── */}
      <div style={{ padding: '4rem 0 3rem' }}>
        <div className="container">
          <div
            className="footer-grid"
            style={{ marginBottom: '3.5rem' }}
          >
            {/* Brand column */}
            <div>
              {/* Logo */}
              <Link
                href="/"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', textDecoration: 'none' }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    background: 'var(--clr-brand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '1.2rem',
                      fontWeight: 700,
                      color: '#fff',
                      lineHeight: 1,
                    }}
                  >
                    N
                  </span>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 600, color: '#fff', lineHeight: 1.1 }}>
                    Nandana
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--clr-brand)', marginTop: '2px' }}>
                    Textile
                  </div>
                </div>
              </Link>

              <p
                style={{
                  fontSize: '0.8125rem',
                  lineHeight: 1.85,
                  color: 'rgba(255,255,255,0.4)',
                  maxWidth: '270px',
                  marginBottom: '1.75rem',
                }}
              >
                Sri Lanka's trusted textile and uniform specialist. Quality fabrics for school, office, and everyday life — since 2009.
              </p>

              {/* Social */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {SOCIAL.map(s => (
                  <a
                    key={s.id}
                    href={s.href}
                    aria-label={s.label}
                    style={{
                      width: '34px',
                      height: '34px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 'var(--r-xs)',
                      color: 'rgba(255,255,255,0.45)',
                      transition: 'all 200ms ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--clr-brand)';
                      (e.currentTarget as HTMLElement).style.color       = '#fff';
                      (e.currentTarget as HTMLElement).style.background  = 'var(--clr-brand)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
                      (e.currentTarget as HTMLElement).style.color       = 'rgba(255,255,255,0.45)';
                      (e.currentTarget as HTMLElement).style.background  = 'transparent';
                    }}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill={s.fill ? 'currentColor' : 'none'}
                      stroke={s.fill ? 'none' : 'currentColor'}
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={s.path} />
                    </svg>
                  </a>
                ))}
              </div>

              {/* Contact */}
              <div style={{ marginTop: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { label: '+94 77 000 0000' },
                  { label: 'info@nandanatextile.lk' },
                  { label: 'Colombo, Sri Lanka' },
                ].map(c => (
                  <p key={c.label} style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                    {c.label}
                  </p>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {COLS.map(col => (
              <div key={col.heading}>
                <h4
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6rem',
                    fontWeight: 500,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.7)',
                    marginBottom: '1.25rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  {col.heading}
                </h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {col.links.map(link => (
                    <ColLink key={link.label} href={link.href} label={link.label} />
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div
            style={{
              paddingTop: '2rem',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.28)' }}>
              &copy; {new Date().getFullYear()} Nandana Textile. All rights reserved.
            </p>
            <div style={{ display: 'flex', gap: '1.75rem' }}>
              {['Privacy Policy', 'Terms of Service'].map(l => (
                <Link
                  key={l}
                  href="#"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6rem',
                    letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.25)',
                    textDecoration: 'none',
                    transition: 'color 150ms ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
                >
                  {l}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
