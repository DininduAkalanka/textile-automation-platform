'use client';

import { useEffect, Suspense } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import TopProgressBar from '@/components/layout/TopProgressBar';
import QuickViewModal from '@/components/products/QuickViewModal';
import { ChatWidget } from '@/components/chat/chat-widget';
import WhatsAppButton from '@/components/layout/WhatsAppButton';

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
      <Suspense fallback={null}>
        <TopProgressBar />
      </Suspense>
      <Header />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
      <QuickViewModal />
      {/* The shopping assistant, on every shop page (doc 10 §5.5). */}
      <ChatWidget />
      {/* Production WhatsApp customer engagement widget (+94 71 708 8445) */}
      <WhatsAppButton />
    </div>
  );
}

