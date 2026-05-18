'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { clientAuth, type ClientUser } from '@/lib/client/auth';
import { getCartCountSnapshot, setupCartListenersOnce, subscribeCart } from '@/lib/client/cart';

const navItems = [
  { href: '/', label: '首页' },
  { href: '/products', label: '商品' },
  { href: '/cart', label: '购物车' },
  { href: '/orders', label: '订单' },
  { href: '/tasks', label: '任务' },
  { href: '/downloads', label: '下载' },
  { href: '/account', label: '账户' },
];

export function ClientShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<ClientUser | null>(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    setUser(clientAuth.getUser());
  }, [pathname]);

  useEffect(() => {
    setupCartListenersOnce();
    setCartCount(getCartCountSnapshot());
    const unsub = subscribeCart(() => {
      setCartCount(getCartCountSnapshot());
    });
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-base font-semibold">
            论文服务平台
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <span className="relative inline-flex items-center gap-1">
                  {item.label}
                  {item.href === '/cart' && cartCount > 0 ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold leading-none text-white">
                      {cartCount > 99 ? '99+' : String(cartCount)}
                    </span>
                  ) : null}
                </span>
              </Link>
            ))}
            {user ? (
              <button
                type="button"
                onClick={() => {
                  clientAuth.clearToken();
                  setUser(null);
                  router.replace('/login');
                }}
                className="rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-100"
              >
                退出登录
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                登录
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        {user ? (
          <p className="mb-4 text-xs text-slate-500">
            当前用户：{user.nickname || user.email || user.phone || user.id}
          </p>
        ) : null}
        {children}
      </main>
    </div>
  );
}
