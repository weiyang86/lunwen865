'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/lib/admin/nav-config';

interface Props {
  item: NavItem;
  collapsed: boolean;
}

export function SidebarNavItem({ item, collapsed }: Props) {
  const pathname = usePathname() ?? '';
  const Icon = item.icon;

  const childActive = !!item.children && item.children.some((c) => pathname.startsWith(c.href));
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (!item.children) {
    const active =
      item.href === '/admin'
        ? pathname === '/admin'
        : !!item.href && pathname.startsWith(item.href);
    return (
      <Link
        href={item.href!}
        title={collapsed ? item.label : undefined}
        className={cn(
          'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          active
            ? 'bg-slate-800 text-white'
            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white',
          collapsed && 'justify-center px-2',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  if (collapsed) {
    return (
      <div className="group relative">
        <button
          type="button"
          title={item.label}
          className={cn(
            'flex w-full items-center justify-center rounded-md px-2 py-2 text-sm transition-colors',
            childActive
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
        <div className="invisible absolute left-full top-0 z-50 ml-2 min-w-max rounded-md border border-slate-700 bg-slate-900 p-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
          <div className="px-3 py-1.5 text-xs font-medium text-slate-400">
            {item.label}
          </div>
          {item.children.map((c) => {
            const active = pathname.startsWith(c.href);
            return (
              <Link
                key={c.href}
                href={c.href}
                className={cn(
                  'block rounded px-3 py-1.5 text-sm',
                  active
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800/60',
                )}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          childActive
            ? 'text-white'
            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="mt-1 ml-7 flex flex-col gap-1 border-l border-slate-800 pl-3">
          {item.children.map((c) => {
            const active = pathname.startsWith(c.href);
            return (
              <Link
                key={c.href}
                href={c.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white',
                )}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
