import Link from 'next/link';

import { BrandMark } from '@/components/brand/brand-mark';
import { SocialIcon } from '@/components/brand/social-icon';
import {
  CONTACT_EMAIL,
  PHONE_LANDLINE,
  PHONE_MOBILE,
  SHOWROOM,
  SITE_NAME,
  activeSocialLinks,
  whatsappUrl,
} from '@/lib/site-config';

/* ── Link columns ───────────────────────────────────────────
 * Every link here must open a real page with real content. The footer used to
 * carry seven "#" links (socials, shipping, size guide, FAQ, privacy, terms). */
const COLS = [
  {
    heading: 'Shop',
    links: [
      { label: 'New Arrivals', href: '/products?category=new-arrivals' },
      { label: 'Women', href: '/products?category=women' },
      { label: 'Men', href: '/products?category=men' },
      { label: 'Teenagers', href: '/products?category=teenagers' },
      { label: 'All Products', href: '/products' },
    ],
  },
  {
    heading: 'Uniforms',
    links: [
      { label: 'Government School Uniforms', href: '/products?category=uniforms&sub=government-school' },
      { label: 'Private School Uniforms', href: '/products?category=uniforms&sub=private-school' },
      { label: 'Corporate Office Wear', href: '/products?category=corporate-uniforms' },
      { label: 'Workwear & Industrial', href: '/products?category=industrial-uniforms' },
      { label: 'Healthcare & Hospitality', href: '/products?category=healthcare-uniforms' },
    ],
  },
  {
    heading: 'Customer Care',
    links: [
      { label: 'Track My Order', href: '/account/orders' },
      { label: 'Contact & Showroom', href: '/contact' },
      { label: 'Shipping & Delivery', href: '/shipping' },
      { label: 'Returns & Exchange', href: '/returns-exchange' },
      { label: 'Size & Fit Guide', href: '/size-guide' },
      { label: 'FAQs', href: '/contact#faq' },
    ],
  },
];

const LEGAL = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
];

const linkClass =
  'group inline-flex items-center gap-2 text-[0.8125rem] leading-normal text-white/55 no-underline transition-all duration-150 hover:gap-3 hover:text-white/90 focus-visible:text-white focus-visible:outline-none';

function ColLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link href={href} className={linkClass}>
        <span aria-hidden className="block h-px w-3.5 shrink-0 bg-white/20 transition-colors group-hover:bg-[var(--clr-brand)]" />
        {label}
      </Link>
    </li>
  );
}

const headingStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  fontWeight: 500,
  letterSpacing: '0.16em',
  textTransform: 'uppercase' as const,
  color: 'rgba(255,255,255,0.7)',
  marginBottom: '1.25rem',
  paddingBottom: '0.75rem',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
};

/* ── Footer ─────────────────────────────────────────────── */
export default function Footer() {
  const socials = activeSocialLinks();
  const contacts = [
    { icon: 'phone' as const, label: `${PHONE_MOBILE.display} (Mobile & WhatsApp)`, href: `tel:${PHONE_MOBILE.tel}` },
    { icon: 'phone' as const, label: `${PHONE_LANDLINE.display} (Veyangoda)`, href: `tel:${PHONE_LANDLINE.tel}` },
    { icon: 'mail' as const, label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  ];

  return (
    <footer style={{ background: 'var(--obsidian-950)', color: 'rgba(255,255,255,0.45)' }}>
      <div style={{ padding: '4rem 0 0' }}>
        <div className="container">
          <div className="footer-grid" style={{ marginBottom: '3.5rem' }}>
            {/* Brand column */}
            <div>
              <Link
                href="/"
                aria-label={`${SITE_NAME} home`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', textDecoration: 'none' }}
              >
                <BrandMark size={38} variant="onDark" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 600, color: '#fff', lineHeight: 1.1 }}>
                    Nandana
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--clr-brand)', marginTop: '2px' }}>
                    Textile
                  </div>
                </div>
              </Link>

              <p style={{ fontSize: '0.8125rem', lineHeight: 1.85, color: 'rgba(255,255,255,0.5)', maxWidth: '290px', marginBottom: '1.5rem' }}>
                Sri Lanka&apos;s trusted textile and uniform specialist. Quality fabrics for school, office, and everyday life.
              </p>

              {/* Social profiles — only those with a real URL are shown. */}
              {socials.length > 0 && (
                <ul aria-label="Follow us" className="mb-6 flex list-none gap-2 p-0">
                  {socials.map((s) => (
                    <li key={s.id}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${SITE_NAME} on ${s.label} (opens in a new tab)`}
                        title={s.label}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-xs)] border border-white/15 text-white/60 transition-colors duration-200 hover:border-[var(--clr-brand)] hover:bg-[var(--clr-brand)] hover:text-white focus-visible:border-white focus-visible:text-white focus-visible:outline-none"
                      >
                        <SocialIcon name={s.id} size={16} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {/* Contact — every line is tappable. */}
              <ul className="flex list-none flex-col gap-2.5 p-0" aria-label="Contact">
                {contacts.map((c) => (
                  <li key={c.href}>
                    <a href={c.href} className="inline-flex items-center gap-2.5 text-[0.78rem] text-white/55 no-underline transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.03em' }}>
                      <SocialIcon name={c.icon} size={14} className="shrink-0 text-[var(--clr-brand)]" />
                      {c.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href={SHOWROOM.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${SHOWROOM.listingName}, ${SHOWROOM.address} — open in Google Maps`}
                    className="inline-flex items-start gap-2.5 text-[0.78rem] text-white/55 no-underline transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none"
                    style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.03em' }}
                  >
                    <SocialIcon name="map-pin" size={14} className="mt-0.5 shrink-0 text-[var(--clr-brand)]" />
                    {SHOWROOM.address}
                  </a>
                </li>
                <li>
                  <a href={whatsappUrl('Hello Nandana Textile, I have a question.')} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-2 rounded-[var(--r-xs)] bg-[#25D366] px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-wider text-white no-underline transition-opacity hover:opacity-90">
                    <SocialIcon name="whatsapp" size={14} />
                    Chat on WhatsApp
                  </a>
                </li>
              </ul>
            </div>

            {/* Link columns */}
            {COLS.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <h4 style={headingStyle}>{col.heading}</h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: 0 }}>
                  {col.links.map((link) => (
                    <ColLink key={link.label} href={link.href} label={link.label} />
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          {/* Bottom bar. The bottom padding keeps the © line and legal links
              clear of the floating WhatsApp and chat buttons on every screen. */}
          <div
            className="pb-40 sm:pb-24"
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
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)' }}>
              &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
            </p>
            <nav aria-label="Legal" className="flex gap-7">
              {LEGAL.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-[0.65rem] tracking-[0.08em] text-white/45 no-underline transition-colors hover:text-white/85 focus-visible:text-white focus-visible:outline-none"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
