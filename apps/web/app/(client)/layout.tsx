import type { ReactNode } from 'react';
import { ClientShell } from '@/components/client/client-shell';
import { ClientAuthGate } from '@/components/client/client-auth-gate';

export default function ClientLayout({ children }: { children: ReactNode }) {
  return <ClientShell><ClientAuthGate>{children}</ClientAuthGate></ClientShell>;
}
