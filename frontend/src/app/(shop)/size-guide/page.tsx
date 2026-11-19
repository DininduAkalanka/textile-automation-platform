import type { Metadata } from 'next';
import Link from 'next/link';

import { PolicyLayout, PolicySection } from '@/components/legal/policy-layout';
import { SizeChartTable } from '@/components/legal/size-chart-table';
import { SITE_NAME, whatsappUrl } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Size & Fit Guide',
  description: `Find your size at ${SITE_NAME}: size chart in inches and centimetres, and how to measure yourself.`,
  alternates: { canonical: '/size-guide' },
};

export default function SizeGuidePage() {
  return (
    <PolicyLayout
      eyebrow="Customer care"
      title="Size & Fit Guide"
      intro={<p>Use the chart to find your size, or order made-to-measure for a perfect fit.</p>}
    >
      <PolicySection title="Size chart">
        <SizeChartTable />
        <p>
          Between two sizes? Choose the larger one for a relaxed fit. Each product page also has its own Size Guide
          button next to the size options.
        </p>
      </PolicySection>

      <PolicySection title="How to measure yourself">
        <p>Use a soft measuring tape, wear light clothing, and keep the tape snug but not tight.</p>
        <ul>
          <li><strong>Chest:</strong> around the fullest part of your chest, under your arms, keeping the tape level.</li>
          <li><strong>Waist:</strong> around your natural waistline, just above the belly button.</li>
          <li><strong>Shoulders:</strong> straight across your back, from one shoulder edge to the other.</li>
          <li><strong>Length:</strong> from the highest point of the shoulder down to where you want the garment to end.</li>
        </ul>
        <p>For uniforms and shirts, it also helps to know your collar size and sleeve length.</p>
      </PolicySection>

      <PolicySection title="Made-to-measure">
        <p>
          Many of our uniforms and tailored garments can be made to your exact measurements. On those products you
          enter your measurements when you add the item to your cart, and our tailors make it for you. Read about
          made-to-measure orders in our <Link href="/terms">Terms of Service</Link>.
        </p>
      </PolicySection>

      <PolicySection title="Still not sure?">
        <p>
          <a href={whatsappUrl('Hello Nandana Textile, could you help me choose the right size?')} target="_blank" rel="noopener noreferrer">
            Send us your measurements on WhatsApp
          </a>{' '}
          and we will recommend a size, or visit a showroom to try garments on. If something doesn&apos;t fit, see{' '}
          <Link href="/returns-exchange">Returns &amp; Exchange</Link>.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
