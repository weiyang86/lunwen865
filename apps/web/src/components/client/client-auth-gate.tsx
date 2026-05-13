'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { clientAuth } from '@/lib/client/auth';
import { clientHttp } from '@/lib/client/api-client';
const PUBLIC_PATHS = new Set(['/login']);
export function ClientAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentPath = pathname || '/';
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (PUBLIC_PATHS.has(currentPath)) { if (mounted) setLoading(false); return; }
      const token = clientAuth.getToken();
      if (!token) { router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`); return; }
      try { const user = await clientHttp.get<{ id: string; email?: string; phone?: string; nickname?: string; role?: string }>('/auth/me'); clientAuth.setUser(user); if (mounted) setLoading(false); }
      catch { clientAuth.clearToken(); router.replace(`/login?redirect=${encodeURIComponent(currentPath)}&error=session`); }
    };
    void check();
    return () => { mounted = false; };
  }, [currentPath, router]);
  if (loading && !PUBLIC_PATHS.has(currentPath)) return <div className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">正在校验登录状态...</div>;
  return <>{children}</>;
}
