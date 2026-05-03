'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { RoleGuard } from '@/components/admin/auth/role-guard';
import { AdminShell } from '@/components/admin/layout/admin-shell';

export default function AdminAuthedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname() ?? '';
  if (pathname.startsWith('/admin/login')) return <>{children}</>;

  return (
    <RoleGuard>
      <AdminShell>{children}</AdminShell>
    </RoleGuard>
  );
}
