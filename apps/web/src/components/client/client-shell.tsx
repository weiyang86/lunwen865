import Link from 'next/link';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/', label: '首页' },
  { href: '/products', label: '商品' },
  { href: '/orders', label: '订单' },
  { href: '/tasks', label: '任务' },
  { href: '/downloads', label: '下载' },
  { href: '/account', label: '账户' },
  { href: '/login', label: '登录' },
];

export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
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
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
