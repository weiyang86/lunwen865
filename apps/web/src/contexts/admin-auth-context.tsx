'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { adminAuth } from '@/lib/admin/auth';
import { adminHttp } from '@/lib/admin/api-client';
import type { AdminUser } from '@/lib/admin/types';

interface AdminAuthContextValue {
  user: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(
  undefined,
);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const token = adminAuth.getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    const cached = adminAuth.getUser();
    if (cached) setUser(cached);

    try {
      const me = await adminHttp.get<AdminUser>('/auth/me');
      if (!adminAuth.isAdminRole(me.role)) {
        adminAuth.removeToken();
        setUser(null);
      } else {
        adminAuth.setUser(me);
        setUser(me);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await adminHttp.post<{ token: string; user: AdminUser }>(
      '/auth/login',
      { email, password },
    );
    if (!adminAuth.isAdminRole(data.user.role)) {
      throw { code: 403, message: '该账号无管理后台访问权限' };
    }
    adminAuth.setToken(data.token);
    adminAuth.setUser(data.user);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    adminAuth.removeToken();
    setUser(null);
    router.replace('/admin/login');
  }, [router]);

  const refresh = useCallback(async () => {
    try {
      const me = await adminHttp.get<AdminUser>('/auth/me');
      adminAuth.setUser(me);
      setUser(me);
    } catch {
      return;
    }
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}

