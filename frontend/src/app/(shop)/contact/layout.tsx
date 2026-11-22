import type { Metadata } from 'next';

// The page is a client component, so its title, description and canonical URL
// live here (it used to inherit the home page's canonical URL).
export const metadata: Metadata = {
  title: 'Contact Us & Showroom',
  description:
    "Visit the Nandana Textile showroom in Veyangoda or contact us by phone, WhatsApp or email for orders, sizing help and bulk uniform quotes.",
  alternates: { canonical: '/contact' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
