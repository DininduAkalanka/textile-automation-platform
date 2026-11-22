import type { Metadata } from 'next';

// The page is a client component, so its title, description and canonical URL
// live here (it used to inherit the home page's canonical URL).
export const metadata: Metadata = {
  title: 'Returns & Exchanges',
  description:
    "How to exchange an item bought from Nandana Textile: time limits, condition, and how to arrange an exchange at our showroom.",
  alternates: { canonical: '/returns-exchange' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
