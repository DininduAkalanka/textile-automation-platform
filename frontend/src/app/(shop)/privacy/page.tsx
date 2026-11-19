import type { Metadata } from 'next';
import Link from 'next/link';

import { PolicyLayout, PolicySection } from '@/components/legal/policy-layout';
import { CONTACT_EMAIL, PHONE_MOBILE, SITE_NAME } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${SITE_NAME} collects, uses and protects your personal information.`,
  alternates: { canonical: '/privacy' },
};

/*
 * Written from what this system actually does (what it stores, which outside
 * services receive data), against Sri Lanka's Personal Data Protection Act,
 * No. 9 of 2022. Have the shop's legal adviser review it before relying on it.
 */
export default function PrivacyPage() {
  return (
    <PolicyLayout
      eyebrow="Your data"
      title="Privacy Policy"
      updated="19 November 2026"
      intro={
        <p>
          This policy explains what personal information {SITE_NAME} collects when you use this website, why we
          collect it, who we share it with, and the choices you have. We only collect what we need to sell to you,
          deliver your order and keep your account secure.
        </p>
      }
    >
      <PolicySection title="1. Who we are">
        <p>
          {SITE_NAME} is a textile and uniform retailer in Sri Lanka. We are responsible for the personal information
          described here. You can reach us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or{' '}
          <a href={`tel:${PHONE_MOBILE.tel}`}>{PHONE_MOBILE.display}</a>.
        </p>
      </PolicySection>

      <PolicySection title="2. Information we collect">
        <ul>
          <li>
            <strong>Account details:</strong> your name, email address and/or mobile number, and your password (stored
            only in a securely scrambled form that we cannot read).
          </li>
          <li>
            <strong>Order details:</strong> delivery and billing addresses, the items you order, order notes and your
            order history.
          </li>
          <li>
            <strong>Body measurements:</strong> only if you order a made-to-measure item and enter measurements for it.
          </li>
          <li>
            <strong>Payment status:</strong> whether a payment succeeded and the payment reference. Card details are
            entered on PayHere&apos;s secure page and are <strong>never</strong> sent to or stored by us.
          </li>
          <li>
            <strong>Verification codes:</strong> one-time codes we send to confirm your email or phone number.
          </li>
          <li>
            <strong>Reviews:</strong> ratings, comments and any photos you choose to add to a product review.
          </li>
          <li>
            <strong>Security information:</strong> the network (IP) address used to place guest orders and records of
            failed sign-in attempts, used to prevent fraud and protect accounts.
          </li>
          <li>
            <strong>Shopping assistant messages:</strong> questions you type into the on-site shopping assistant.
          </li>
        </ul>
      </PolicySection>

      <PolicySection title="3. How we use it">
        <ul>
          <li>To process, deliver and support your orders, including Cash on Delivery and installment plans.</li>
          <li>To create and secure your account, and to verify your email or phone number.</li>
          <li>To make made-to-measure garments to the measurements you provide.</li>
          <li>To send you order updates and service messages (not marketing) by email or SMS.</li>
          <li>To answer your enquiries and show your reviews on our product pages.</li>
          <li>To prevent fraud and abuse, and to meet our legal and accounting obligations.</li>
        </ul>
        <p>We do not sell your personal information, and we do not use it for advertising profiles.</p>
      </PolicySection>

      <PolicySection title="4. Who we share it with">
        <p>Only with service providers that help us run the shop, and only what each one needs:</p>
        <ul>
          <li><strong>PayHere</strong>: to process card payments.</li>
          <li><strong>Email and SMS delivery providers</strong>: to send verification codes and order messages.</li>
          <li><strong>Delivery partners</strong>: your name, phone number and address, to deliver your parcel.</li>
          <li>
            <strong>Hosting and database providers</strong>: our website and data are hosted with cloud providers,
            which may store data on servers outside Sri Lanka.
          </li>
          <li>
            <strong>An artificial intelligence (AI) provider</strong>: messages you type into the shopping assistant
            are sent to it so it can suggest products. Please don&apos;t include personal details in those messages.
          </li>
          <li>
            <strong>WhatsApp</strong>: if you choose to contact us on WhatsApp, that conversation is also subject to
            WhatsApp&apos;s own privacy policy.
          </li>
        </ul>
        <p>We may also disclose information where the law requires it.</p>
      </PolicySection>

      <PolicySection title="5. Cookies and browser storage">
        <p>
          We use one essential cookie to keep you signed in securely. Your browser also stores your cart, wishlist and
          display preferences on your own device. We do not use advertising or tracking cookies, and we do not run
          third-party analytics on this site.
        </p>
      </PolicySection>

      <PolicySection title="6. How long we keep it">
        <ul>
          <li>Account information: while your account is open, or until you ask us to delete it.</li>
          <li>Orders and payment records: as long as required for accounting, tax and legal purposes.</li>
          <li>Verification codes: a short time only; they expire within minutes.</li>
          <li>Review photos that are uploaded but never added to a review are deleted automatically within a day.</li>
        </ul>
      </PolicySection>

      <PolicySection title="7. Your rights">
        <p>Under Sri Lanka&apos;s Personal Data Protection Act, No. 9 of 2022, you can ask us to:</p>
        <ul>
          <li>tell you what personal information we hold about you and give you a copy;</li>
          <li>correct information that is wrong or incomplete;</li>
          <li>delete your information, where we are not required to keep it;</li>
          <li>stop using your information for a purpose you object to, or withdraw consent you gave.</li>
        </ul>
        <p>
          Contact us using the details in section 1. We may need to confirm your identity before acting on a request.
        </p>
      </PolicySection>

      <PolicySection title="8. Keeping it safe">
        <p>
          Connections to this site are encrypted, passwords are stored in a scrambled form, card details never reach
          our systems, and access to customer information is limited to staff who need it. Accounts are temporarily
          locked after repeated wrong passwords.
        </p>
      </PolicySection>

      <PolicySection title="9. Changes to this policy">
        <p>
          If we change this policy we will update this page and the date at the top. See also our{' '}
          <Link href="/terms">Terms of Service</Link>.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
