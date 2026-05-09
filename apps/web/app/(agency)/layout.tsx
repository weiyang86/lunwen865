import type { ReactNode } from 'react';
import { AgencyShell } from '@/components/agency/agency-shell';

export default function AgencyLayout({ children }: { children: ReactNode }) {
  return <AgencyShell>{children}</AgencyShell>;
}
