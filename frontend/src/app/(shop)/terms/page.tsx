import type { Metadata } from 'next';
import Link from 'next/link';

import { PolicyLayout, PolicySection } from '@/components/legal/policy-layout';
import { SITE_NAME } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `The terms that apply when you shop with ${SITE_NAME} online.`,
  alternates: { canonical: '/terms' },
};

/*
 * Every rule stated here is one the system actually enforces (order
 * confirmation, the 30-minute hold on unpaid online orders, cancellation while
 * pending, the installment plan). Have the shop's legal adviser review it
 * before relying on it.
 */
export default function TermsPage() {
  return (
    <PolicyLayout
      eyebrow="Shopping with us"
      title="Terms of Service"
      updated="19 November 2026"
      intro={
        <p>
          These terms apply when you use this website or buy from {SITE_NAME} online. By placing an order you agree
          to them. Please also read our <Link href="/privacy" className="text-[#CC0000] underline underline-offset-2">Privacy Policy</Link>.
        </p>
      }
    >
      <PolicySection title="1. Your account">
        <ul>
          <li>Keep your password private. You are responsible for orders placed from your account.</li>
          <li>For your protection, an account is locked for a short time after several wrong passwords.</li>
          <li>
            If you check out as a guest using an email or phone number that already has an account, we will ask you to
            sign in first.
          </li>
        </ul>
      </PolicySection>

      <PolicySection title="2. Prices">
        <p>
          Prices are in Sri Lankan Rupees (LKR). The total shown at checkout is the amount you pay, and delivery
          within Sri Lanka is free. If a product is listed at an obviously wrong price, we may cancel the order and
          refund anything you paid.
        </p>
      </PolicySection>

      <PolicySection title="3. Placing and confirming an order">
        <ul>
          <li><strong>Cash on Delivery:</strong> your order is confirmed when you place it. Guest customers confirm their phone or email with a one-time code first.</li>
          <li><strong>Card payment (PayHere):</strong> your order is confirmed once the payment succeeds.</li>
          <li><strong>Installments:</strong> your order is confirmed once the first installment is paid.</li>
          <li>
            Items in an unpaid online order are held for <strong>30 minutes</strong>. If payment is not completed in
            that time, the order is cancelled automatically and the items are released.
          </li>
          <li>
            One order can contain up to 20 of each item. For larger or bulk orders, such as school or corporate
            uniforms, please <Link href="/contact">contact us</Link>.
          </li>
        </ul>
        <p>We may decline or cancel an order if an item becomes unavailable; any payment made is refunded in full.</p>
      </PolicySection>

      <PolicySection title="4. Installment plan">
        <p>
          With Monthly Installments the order total is split into 3 equal payments with no interest or extra charges.
          The first is paid at checkout; the second and third are due one and two months later, and you pay each
          one online from <Link href="/account/orders">My Orders</Link>. Nothing is deducted automatically. You need an
          account to use installments.
        </p>
      </PolicySection>

      <PolicySection title="5. Cancelling an order">
        <p>
          You can cancel an order yourself from <Link href="/account/orders">My Orders</Link> while it is still
          pending. Once it is confirmed or in production, please contact us and we will help where we can.
        </p>
      </PolicySection>

      <PolicySection title="6. Made-to-measure items">
        <p>
          Made-to-measure garments are tailored to the measurements you provide, so please check them carefully before
          ordering. Because they are made for you, they cannot be returned or exchanged unless they are faulty or do
          not match the measurements you gave us.
        </p>
      </PolicySection>

      <PolicySection title="7. Delivery, returns and exchanges">
        <p>
          See <Link href="/shipping">Shipping &amp; Delivery</Link> for delivery times, and{' '}
          <Link href="/returns-exchange">Returns &amp; Exchange</Link> for how to return or exchange an item. Nothing
          in these terms limits your rights under Sri Lankan consumer law.
        </p>
      </PolicySection>

      <PolicySection title="8. Reviews">
        <p>
          Only customers who received the product can review it. Photos you add must be your own. We may hide reviews
          that are offensive, misleading or unrelated to the product.
        </p>
      </PolicySection>

      <PolicySection title="9. Shopping assistant">
        <p>
          The on-site shopping assistant suggests products to help you browse. Its answers are guidance only: the
          price, stock and details shown on each product page are what apply to your order.
        </p>
      </PolicySection>

      <PolicySection title="10. Product information">
        <p>
          We describe and photograph our products as accurately as we can. Colours can look slightly different on
          different screens, and fabric texture may vary slightly between batches.
        </p>
      </PolicySection>

      <PolicySection title="11. Governing law">
        <p>These terms are governed by the laws of Sri Lanka.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
