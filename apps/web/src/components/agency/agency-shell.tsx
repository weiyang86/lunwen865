import Link from 'next/link';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/agency', label: '机构工作台' },
  { href: '/agency/leads', label: '线索管理' },
  { href: '/agency/orders', label: '代下单管理' },
  { href: '/agency/progress', label: '进度追踪' },
];

export function AgencyShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/agency" className="text-base font-semibold">
            机构协同中心
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
