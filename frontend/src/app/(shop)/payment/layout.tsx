import type { Metadata } from 'next';

// Personal / transactional pages: no value in search results, so they are kept
// out (noindex) while links on them are still followed.
export const metadata: Metadata = {
  title: 'Payment',
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
