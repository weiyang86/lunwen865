'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAdminAuth } from '@/contexts/admin-auth-context';

interface Props {
  children: ReactNode;
  requireRoles?: Array<'ADMIN' | 'SUPER_ADMIN'>;
}

export function RoleGuard({
  children,
  requireRoles = ['ADMIN', 'SUPER_ADMIN'],
}: Props) {
  const { user, isLoading, isAuthenticated } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      const redirect = encodeURIComponent(pathname || '/admin');
      router.replace(`/admin/login?redirect=${redirect}`);
      return;
    }
    if (user && !requireRoles.includes(user.role as any)) {
      router.replace('/admin/login');
    }
  }, [isLoading, isAuthenticated, user, requireRoles, router, pathname]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return <>{children}</>;
}

