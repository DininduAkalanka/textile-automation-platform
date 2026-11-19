import Link from 'next/link';
import type { ReactNode } from 'react';

import { CONTACT_EMAIL, PHONE_MOBILE, whatsappUrl } from '@/lib/site-config';

/**
 * Shared layout for the customer-information pages (privacy, terms, shipping,
 * size guide): breadcrumb, heading, a "last updated" line, readable body
 * text, and a contact box at the end so every page ends with a way to ask.
 */
export function PolicyLayout({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-neutral-50 min-h-screen text-neutral-800">
      <div className="bg-white border-b border-neutral-200/80">
        <div className="container mx-auto px-4 py-3.5">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-neutral-500">
            <Link href="/" className="hover:text-neutral-900 transition-colors">
              Home
            </Link>
            <span className="text-neutral-300" aria-hidden>
              /
            </span>
            <span className="text-neutral-900 font-medium" aria-current="page">
              {title}
            </span>
          </nav>
        </div>
      </div>

      <header className="bg-white border-b border-neutral-200/80 py-10 sm:py-14">
        <div className="container mx-auto px-4 max-w-3xl">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#CC0000] font-semibold block mb-2">
            {eyebrow}
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">{title}</h1>
          <div className="mt-3 text-sm sm:text-base text-neutral-600 leading-relaxed max-w-2xl">{intro}</div>
          {updated && <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-neutral-400">Last updated: {updated}</p>}
        </div>
      </header>

      <article className="container mx-auto px-4 max-w-3xl py-10 sm:py-14">
        <div className="space-y-10">{children}</div>

        <aside className="mt-14 rounded-xl border border-neutral-200 bg-white p-6 sm:p-7">
          <h2 className="font-serif text-lg font-bold text-neutral-900">Questions?</h2>
          <p className="mt-1 text-sm text-neutral-600">Our team is happy to help.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={whatsappUrl(`Hello Nandana Textile, I have a question about: ${title}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#20ba59]"
            >
              WhatsApp us
            </a>
            <a
              href={`tel:${PHONE_MOBILE.tel}`}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-neutral-800 transition-colors hover:border-neutral-900"
            >
              Call {PHONE_MOBILE.display}
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-neutral-800 transition-colors hover:border-neutral-900"
            >
              Email us
            </a>
          </div>
        </aside>
      </article>
    </div>
  );
}

export function PolicySection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-serif text-xl font-bold text-neutral-900 mb-3">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-neutral-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:text-[#CC0000] [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-neutral-900">
        {children}
      </div>
    </section>
  );
}
