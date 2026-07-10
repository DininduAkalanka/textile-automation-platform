'use client';

import { useEffect, Suspense } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AppPreloader from '@/components/layout/AppPreloader';
import TopProgressBar from '@/components/layout/TopProgressBar';
import QuickViewModal from '@/components/products/QuickViewModal';
import VisualSearchModal from '@/components/products/VisualSearchModal';

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppPreloader />
      <Suspense fallback={null}>
        <TopProgressBar />
      </Suspense>
      <Header />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
      <QuickViewModal />
      <VisualSearchModal />
    </div>
  );
}

