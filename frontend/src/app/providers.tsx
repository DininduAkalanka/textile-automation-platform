'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';

import { setSessionExpiredHandler } from '@/services/http';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * TanStack Query + toasts (doc 05 §3.4, doc 10 §9.3).
 *
 * The QueryClient is created inside useState rather than at module scope. At
 * module scope it would be shared across every request the Next.js server
 * handles, so one user's cached data could be served to another.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // A 401 is handled by the axios interceptor (refresh + one retry).
            // Retrying here as well would multiply failed requests.
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const clearSession = useAuthStore((s) => s.clearSession);

  // The axios interceptor cannot import the store directly without a cycle
  // (store -> services -> store), so it calls back through this handler when a
  // refresh finally fails.
  useEffect(() => {
    setSessionExpiredHandler(clearSession);
  }, [clearSession]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
