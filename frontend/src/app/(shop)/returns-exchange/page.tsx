'use client';

import Link from 'next/link';
import { useState } from 'react';

/* ── Types ─────────────────────────────────────────────────────── */
interface Section {
  id: string;
  icon: string;
  title: string;
  content: React.ReactNode;
}

/* ── Policy sections ────────────────────────────────────────────── */
const SECTIONS: Section[] = [
  {
    id: 'overview',
    icon: '↩',
    title: 'Returns & Exchange Overview',
    content: (
      <>
        <p>
          At <strong>Nandana Textile</strong>, your satisfaction is our priority. We gladly accept
          returns and exchanges for eligible items, provided that a request is submitted within{' '}
          <strong>7 working days</strong> of receiving your order.
        </p>
        <p>
          Items must be returned in their <strong>original condition</strong> — unused, unwashed,
          unaltered, and in their original packaging with all tags intact. Items that have been worn,
          washed, or customised (e.g., school uniforms with embroidered names) are not eligible.
        </p>
      </>
    ),
  },
  {
    id: 'courier',
    icon: '🚚',
    title: '1. Returns via Courier Collection',
    content: (
      <>
        <p>
          If you are unable to visit our showroom, we offer a <strong>courier collection service</strong>{' '}
          for returns. Please note that courier charges will be deducted from your refund or exchange.
        </p>
        <ul>
          <li>Contact us via WhatsApp or email within 7 working days of delivery to initiate a courier return.</li>
          <li>Pack the item securely in its original packaging.</li>
          <li>Our logistics partner will collect the item from your address within 2–3 working days.</li>
          <li>Once the item is received and inspected, your refund or replacement will be processed within 5–7 working days.</li>
        </ul>
        <div className="policy-note">
          <span className="policy-note__icon">ℹ</span>
          <span>Courier collection is available within Sri Lanka only. A handling fee of LKR 350–600 may apply depending on your location.</span>
        </div>
      </>
    ),
  },
  {
    id: 'drop-off',
    icon: '🏬',
    title: '2. Returns via In-Store Drop-Off',
    content: (
      <>
        <p>
          You may return or exchange items in person at our showroom with no additional charges.
          This is the fastest way to process your return.
        </p>
        <ul>
          <li>Bring your item(s) along with proof of purchase (order confirmation or receipt).</li>
          <li>Our team will inspect the item on the spot.</li>
          <li>Exchanges are processed immediately (subject to stock availability).</li>
          <li>Refunds to your original payment method are processed within 3–5 working days.</li>
        </ul>
        <div className="policy-address">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <div>
            <strong>Nandana Textile Showroom</strong><br />
            No. 145, Main Street, Kurunegala, Sri Lanka<br />
            Open Mon–Sat: 8:30 AM – 6:00 PM
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'non-returnable',
    icon: '🚫',
    title: '3. Non-Returnable Items',
    content: (
      <>
        <p>The following items <strong>cannot be returned or exchanged</strong> under any circumstances:</p>
        <ul>
          <li>Customised or embroidered items (e.g., school uniforms with student names or logos)</li>
          <li>Undergarments, socks, and similar intimate apparel</li>
          <li>Items marked as <strong>"Final Sale"</strong> or <strong>"Clearance"</strong></li>
          <li>Items that have been worn, washed, altered, or damaged after delivery</li>
          <li>Items without original tags or packaging</li>
          <li>Bulk uniform orders placed under institutional contracts (subject to contract terms)</li>
        </ul>
        <div className="policy-note policy-note--warning">
          <span className="policy-note__icon">⚠</span>
          <span>Nandana Textile reserves the right to refuse returns that do not meet the above conditions.</span>
        </div>
      </>
    ),
  },
  {
    id: 'defective',
    icon: '🔍',
    title: '4. Defective or Incorrect Items',
    content: (
      <>
        <p>
          We take quality seriously. If you receive a <strong>defective, damaged, or incorrect item</strong>,
          please contact us within <strong>48 hours</strong> of delivery.
        </p>
        <ul>
          <li>Send a clear photo of the defect/issue to our WhatsApp or email.</li>
          <li>We will arrange a free courier collection or an in-store replacement.</li>
          <li>Defective items will be replaced or fully refunded at no cost to you.</li>
          <li>Colour variation due to screen display settings is not considered a defect.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'refunds',
    icon: '💳',
    title: '5. Refunds',
    content: (
      <>
        <p>Once your return is approved and the item is received, refunds are processed as follows:</p>
        <div className="policy-table">
          <div className="policy-table__row policy-table__row--header">
            <span>Payment Method</span>
            <span>Refund Timeline</span>
          </div>
          <div className="policy-table__row">
            <span>Cash on Delivery</span>
            <span>Bank transfer within 5–7 working days</span>
          </div>
          <div className="policy-table__row">
            <span>Bank Transfer / Online Payment</span>
            <span>Reversed within 5–7 working days</span>
          </div>
          <div className="policy-table__row">
            <span>Store Credit / Exchange</span>
            <span>Immediate upon approval</span>
          </div>
        </div>
        <div className="policy-note">
          <span className="policy-note__icon">ℹ</span>
          <span>Original shipping charges are non-refundable unless the return is due to our error.</span>
        </div>
      </>
    ),
  },
  {
    id: 'contact',
    icon: '📞',
    title: '6. How to Initiate a Return',
    content: (
      <>
        <p>Follow these simple steps to start your return or exchange:</p>
        <div className="policy-steps">
          {[
            { num: '01', text: 'Contact us within 7 working days of receiving your order.' },
            { num: '02', text: 'Provide your order number, item name, and reason for return.' },
            { num: '03', text: 'Send photos if the item is defective or incorrect.' },
            { num: '04', text: 'Our team will confirm eligibility and provide return instructions.' },
            { num: '05', text: 'Pack the item securely and arrange drop-off or courier collection.' },
            { num: '06', text: 'Receive your refund or replacement within the stated timeline.' },
          ].map(({ num, text }) => (
            <div key={num} className="policy-step">
              <span className="policy-step__num">{num}</span>
              <span className="policy-step__text">{text}</span>
            </div>
          ))}
        </div>
        <div className="policy-contact-grid">
          <a href="tel:+94770000000" className="policy-contact-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.08 6.08l1.48-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <div>
              <strong>Call Us</strong>
              <span>+94 77 000 0000</span>
            </div>
          </a>
          <a href="https://wa.me/94770000000" className="policy-contact-card policy-contact-card--whatsapp" target="_blank" rel="noreferrer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
            </svg>
            <div>
              <strong>WhatsApp</strong>
              <span>Chat with us</span>
            </div>
          </a>
          <a href="mailto:support@nandanatextile.lk" className="policy-contact-card policy-contact-card--email">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <div>
              <strong>Email</strong>
              <span>support@nandanatextile.lk</span>
            </div>
          </a>
        </div>
      </>
    ),
  },
];

/* ── Page Component ────────────────────────────────────────────── */
export default function ReturnsExchangePage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const toggle = (id: string) => setActiveSection(prev => (prev === id ? null : id));

  return (
    <>
      {/* ── SEO ──────────────────────────────────────────────── */}
      <title>Returns &amp; Exchange Policy | Nandana Textile</title>
      <meta
        name="description"
        content="Learn about Nandana Textile's returns and exchange policy. We accept returns within 7 working days for eligible items. Fast processing, easy courier collection or in-store drop-off."
      />

      {/* ── Styles ───────────────────────────────────────────── */}
      <style>{`
        /* ── Hero ───────────────────────────── */
        .rp-hero {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          padding: 5rem 0 4rem;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .rp-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(220,150,60,0.15) 0%, transparent 70%);
          pointer-events: none;
        }
        .rp-hero__badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--clr-brand, #d4963a);
          background: rgba(212,150,58,0.12);
          border: 1px solid rgba(212,150,58,0.25);
          padding: 0.35rem 0.875rem;
          border-radius: 50px;
          margin-bottom: 1.5rem;
        }
        .rp-hero__title {
          font-family: var(--font-serif, serif);
          font-size: clamp(2rem, 5vw, 3.5rem);
          font-weight: 700;
          color: #fff;
          line-height: 1.15;
          margin-bottom: 1rem;
        }
        .rp-hero__subtitle {
          font-size: 1rem;
          color: rgba(255,255,255,0.55);
          max-width: 540px;
          margin: 0 auto 2rem;
          line-height: 1.7;
        }
        .rp-hero__breadcrumb {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.4);
        }
        .rp-hero__breadcrumb a {
          color: rgba(255,255,255,0.4);
          text-decoration: none;
          transition: color 200ms;
        }
        .rp-hero__breadcrumb a:hover { color: rgba(255,255,255,0.75); }

        /* ── Summary cards ──────────────────── */
        .rp-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin: -2rem auto 3rem;
          max-width: 1100px;
          padding: 0 1.5rem;
          position: relative;
          z-index: 2;
        }
        .rp-card {
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 16px;
          padding: 1.5rem;
          text-align: center;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
          transition: transform 200ms, box-shadow 200ms;
        }
        .rp-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        .rp-card__icon {
          font-size: 1.75rem;
          margin-bottom: 0.75rem;
          display: block;
        }
        .rp-card__value {
          font-size: 1.375rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
          margin-bottom: 0.25rem;
        }
        .rp-card__label {
          font-size: 0.75rem;
          color: #94a3b8;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        /* ── Main layout ────────────────────── */
        .rp-body {
          max-width: 1100px;
          margin: 0 auto;
          padding: 1rem 1.5rem 5rem;
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 2.5rem;
          align-items: start;
        }
        @media (max-width: 768px) {
          .rp-body { grid-template-columns: 1fr; }
          .rp-sidebar { display: none; }
        }

        /* ── Sidebar nav ────────────────────── */
        .rp-sidebar {
          position: sticky;
          top: 5rem;
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 16px;
          padding: 1.25rem;
          box-shadow: 0 2px 12px rgba(0,0,0,0.05);
        }
        .rp-sidebar__title {
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #94a3b8;
          padding: 0 0.5rem 1rem;
          border-bottom: 1px solid #f0f0f0;
          margin-bottom: 0.75rem;
        }
        .rp-sidebar__link {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.5rem 0.625rem;
          border-radius: 8px;
          font-size: 0.8125rem;
          color: #475569;
          text-decoration: none;
          transition: background 150ms, color 150ms;
          line-height: 1.4;
        }
        .rp-sidebar__link:hover,
        .rp-sidebar__link.active {
          background: rgba(212,150,58,0.08);
          color: #b87828;
        }
        .rp-sidebar__link-icon { font-size: 1rem; flex-shrink: 0; }

        /* ── Accordion sections ─────────────── */
        .rp-section {
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 16px;
          margin-bottom: 1rem;
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          transition: box-shadow 200ms;
        }
        .rp-section:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .rp-section__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1.25rem 1.5rem;
          cursor: pointer;
          background: none;
          border: none;
          width: 100%;
          text-align: left;
          transition: background 150ms;
        }
        .rp-section__header:hover { background: #fafafa; }
        .rp-section__header-left {
          display: flex;
          align-items: center;
          gap: 0.875rem;
        }
        .rp-section__emoji {
          font-size: 1.25rem;
          width: 2.5rem;
          height: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(212,150,58,0.08);
          border-radius: 10px;
          flex-shrink: 0;
        }
        .rp-section__title {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #0f172a;
        }
        .rp-section__chevron {
          width: 20px;
          height: 20px;
          color: #94a3b8;
          transition: transform 250ms ease;
          flex-shrink: 0;
        }
        .rp-section__chevron.open { transform: rotate(180deg); }
        .rp-section__body {
          padding: 0 1.5rem 1.5rem 1.5rem;
          border-top: 1px solid #f0f0f0;
          animation: rp-fade-in 200ms ease;
        }
        @keyframes rp-fade-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rp-section__body p {
          color: #475569;
          font-size: 0.9rem;
          line-height: 1.75;
          margin-top: 1rem;
          margin-bottom: 0.75rem;
        }
        .rp-section__body ul {
          padding-left: 1.25rem;
          color: #475569;
          font-size: 0.875rem;
          line-height: 2;
        }
        .rp-section__body ul li { margin-bottom: 0.125rem; }

        /* ── Policy note ─────────────────────── */
        .policy-note {
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
          background: rgba(59,130,246,0.06);
          border-left: 3px solid #3b82f6;
          border-radius: 0 8px 8px 0;
          padding: 0.75rem 1rem;
          margin-top: 1rem;
          font-size: 0.8375rem;
          color: #1e40af;
          line-height: 1.6;
        }
        .policy-note--warning {
          background: rgba(234,179,8,0.06);
          border-left-color: #ca8a04;
          color: #854d0e;
        }
        .policy-note__icon { font-size: 1rem; flex-shrink: 0; }

        /* ── Address card ────────────────────── */
        .policy-address {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1rem 1.125rem;
          margin-top: 1rem;
          font-size: 0.875rem;
          color: #475569;
          line-height: 1.7;
        }
        .policy-address svg { color: var(--clr-brand, #d4963a); flex-shrink: 0; margin-top: 3px; }

        /* ── Policy table ────────────────────── */
        .policy-table {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
          margin-top: 1rem;
          font-size: 0.875rem;
        }
        .policy-table__row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #f0f4f8;
        }
        .policy-table__row:last-child { border-bottom: none; }
        .policy-table__row--header {
          background: #0f172a;
          color: #fff;
          font-weight: 600;
          font-size: 0.8rem;
          letter-spacing: 0.05em;
        }
        .policy-table__row:not(.policy-table__row--header):hover { background: #f8fafc; }

        /* ── Steps ───────────────────────────── */
        .policy-steps { display: flex; flex-direction: column; gap: 0.625rem; margin-top: 1rem; }
        .policy-step {
          display: flex;
          align-items: flex-start;
          gap: 0.875rem;
          padding: 0.75rem 1rem;
          background: #f8fafc;
          border-radius: 10px;
          font-size: 0.875rem;
          color: #475569;
          line-height: 1.55;
          border: 1px solid #f0f4f8;
        }
        .policy-step__num {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--clr-brand, #d4963a);
          background: rgba(212,150,58,0.1);
          border-radius: 6px;
          padding: 0.15rem 0.45rem;
          flex-shrink: 0;
          letter-spacing: 0.05em;
        }

        /* ── Contact cards ───────────────────── */
        .policy-contact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.875rem;
          margin-top: 1.25rem;
        }
        .policy-contact-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          text-decoration: none;
          color: #0f172a;
          font-size: 0.875rem;
          transition: border-color 200ms, background 200ms, transform 200ms;
        }
        .policy-contact-card:hover {
          border-color: #d4963a;
          background: rgba(212,150,58,0.04);
          transform: translateY(-2px);
        }
        .policy-contact-card--whatsapp:hover { border-color: #25d366; background: rgba(37,211,102,0.04); }
        .policy-contact-card--email:hover { border-color: #6366f1; background: rgba(99,102,241,0.04); }
        .policy-contact-card strong { display: block; font-weight: 600; font-size: 0.875rem; }
        .policy-contact-card span { color: #64748b; font-size: 0.8rem; }

        /* ── Bottom CTA ──────────────────────── */
        .rp-cta {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border-radius: 20px;
          padding: 2.5rem;
          text-align: center;
          margin-top: 2rem;
        }
        .rp-cta h3 {
          font-family: var(--font-serif, serif);
          font-size: 1.375rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 0.5rem;
        }
        .rp-cta p { color: rgba(255,255,255,0.55); font-size: 0.875rem; margin-bottom: 1.5rem; line-height: 1.65; }
        .rp-cta__btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.75rem;
          background: var(--clr-brand, #d4963a);
          color: #fff;
          border-radius: 8px;
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 600;
          transition: opacity 200ms, transform 200ms;
        }
        .rp-cta__btn:hover { opacity: 0.9; transform: translateY(-1px); }
      `}</style>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="rp-hero">
        <div className="container">
          <div className="rp-hero__badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Nandana Textile — Policy
          </div>
          <h1 className="rp-hero__title">Returns &amp; Exchange</h1>
          <p className="rp-hero__subtitle">
            Hassle-free returns within 7 working days. Your satisfaction is our commitment.
          </p>
          <nav className="rp-hero__breadcrumb" aria-label="breadcrumb">
            <Link href="/">Home</Link>
            <span>›</span>
            <span>Returns &amp; Exchange</span>
          </nav>
        </div>
      </section>

      {/* ── Summary cards ────────────────────────────────────── */}
      <div className="rp-cards">
        {[
          { icon: '📅', value: '7 Days',    label: 'Return Window' },
          { icon: '✅', value: 'Free',      label: 'In-Store Exchange' },
          { icon: '⚡', value: '5–7 Days',  label: 'Refund Processing' },
          { icon: '🔒', value: '100%',      label: 'Quality Guarantee' },
        ].map(c => (
          <div className="rp-card" key={c.label}>
            <span className="rp-card__icon">{c.icon}</span>
            <div className="rp-card__value">{c.value}</div>
            <div className="rp-card__label">{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="rp-body">

        {/* Sidebar */}
        <aside className="rp-sidebar">
          <div className="rp-sidebar__title">On This Page</div>
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`rp-sidebar__link${activeSection === s.id ? ' active' : ''}`}
              onClick={e => { e.preventDefault(); setActiveSection(s.id); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            >
              <span className="rp-sidebar__link-icon">{s.icon}</span>
              {s.title.replace(/^\d+\.\s*/, '')}
            </a>
          ))}
        </aside>

        {/* Accordion content */}
        <main>
          {SECTIONS.map(s => {
            const isOpen = activeSection === s.id;
            return (
              <div key={s.id} id={s.id} className="rp-section">
                <button
                  className="rp-section__header"
                  onClick={() => toggle(s.id)}
                  aria-expanded={isOpen}
                  aria-controls={`content-${s.id}`}
                >
                  <div className="rp-section__header-left">
                    <span className="rp-section__emoji">{s.icon}</span>
                    <span className="rp-section__title">{s.title}</span>
                  </div>
                  <svg
                    className={`rp-section__chevron${isOpen ? ' open' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {isOpen && (
                  <div id={`content-${s.id}`} className="rp-section__body">
                    {s.content}
                  </div>
                )}
              </div>
            );
          })}

          {/* CTA */}
          <div className="rp-cta">
            <h3>Still have questions?</h3>
            <p>Our customer support team is ready to assist you with any returns or exchange queries.</p>
            <a href="https://wa.me/94712345678" className="rp-cta__btn" target="_blank" rel="noreferrer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
              </svg>
              Chat on WhatsApp
            </a>
          </div>
        </main>
      </div>
    </>
  );
}
