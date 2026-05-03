import type { ReactNode } from 'react';
import { AdminProviders } from '@/components/admin/providers/admin-providers';

export const metadata = {
  title: '管理后台',
};

export default function AdminGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdminProviders>{children}</AdminProviders>;
}

