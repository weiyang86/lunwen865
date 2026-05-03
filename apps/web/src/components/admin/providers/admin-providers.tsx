'use client';

import { type ReactNode, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';
import { createQueryClient } from '@/lib/admin/query-client';
import { AdminAuthProvider } from '@/contexts/admin-auth-context';

export function AdminProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </AdminAuthProvider>
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

