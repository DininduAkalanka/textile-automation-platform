import type { Metadata } from 'next';
import Link from 'next/link';

import { PolicyLayout, PolicySection } from '@/components/legal/policy-layout';
import { SHOWROOM, SITE_NAME, whatsappUrl } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Shipping & Delivery',
  description: `Free island-wide delivery, Cash on Delivery and showroom collection at ${SITE_NAME}.`,
  alternates: { canonical: '/shipping' },
};

export default function ShippingPage() {
  return (
    <PolicyLayout
      eyebrow="Customer care"
      title="Shipping & Delivery"
      intro={<p>Free delivery to any address in Sri Lanka, with Cash on Delivery available island-wide.</p>}
    >
      <PolicySection title="Delivery cost">
        <p>
          Delivery is <strong>free on every order</strong>, anywhere in Sri Lanka. There is no minimum order value
          and no extra charge at checkout.
        </p>
      </PolicySection>

      <PolicySection title="How long it takes">
        <ul>
          <li>
            <strong>Ready-made items:</strong> usually delivered within <strong>2–3 business days</strong> after your
            order is confirmed.
          </li>
          <li>
            <strong>Made-to-measure items:</strong> take longer, because each garment is cut and stitched to your
            measurements. We will keep you updated, and you can follow every stage in{' '}
            <Link href="/account/orders">My Orders</Link>.
          </li>
        </ul>
      </PolicySection>

      <PolicySection title="When your order is confirmed">
        <ul>
          <li><strong>Cash on Delivery:</strong> as soon as you place the order. Pay the courier in cash when it arrives.</li>
          <li><strong>Card payment:</strong> as soon as your PayHere payment succeeds.</li>
          <li><strong>Installments:</strong> as soon as your first installment is paid.</li>
        </ul>
        <p>Unpaid online orders are cancelled automatically after 30 minutes, so complete your payment to secure your items.</p>
      </PolicySection>

      <PolicySection title="Tracking your order">
        <p>
          Sign in and open <Link href="/account/orders">My Orders</Link> to see the current status of each order. Your
          order number starts with <strong>TXL-</strong>; please quote it when you contact us.
        </p>
      </PolicySection>

      <PolicySection title="Collecting from our showroom">
        <p>
          Prefer to collect? Place your order, then{' '}
          <a href={whatsappUrl('Hello Nandana Textile, I would like to collect my order from your Veyangoda showroom. My order number is: ')} target="_blank" rel="noopener noreferrer">
            message us on WhatsApp
          </a>{' '}
          with your order number. We will confirm when it is ready to collect from:
        </p>
        <p>
          <strong>{SHOWROOM.listingName}</strong>, {SHOWROOM.address} (
          <a href={SHOWROOM.mapsUrl} target="_blank" rel="noopener noreferrer">
            open in Google Maps
          </a>
          )
        </p>
      </PolicySection>

      <PolicySection title="If something goes wrong">
        <p>
          If your parcel is late, damaged, or the courier could not reach you, contact us on WhatsApp with your order
          number and we will sort it out. For returns and exchanges, see{' '}
          <Link href="/returns-exchange">Returns &amp; Exchange</Link>.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
