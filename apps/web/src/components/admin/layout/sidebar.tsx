'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/admin/nav-config';
import { useAdminAuth } from '@/contexts/admin-auth-context';
import { SidebarNavItem } from './sidebar-nav-item';

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: Props) {
  const { user } = useAdminAuth();

  const visibleItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (!item.roles) return true;
      return !!user && item.roles.includes(user.role as any);
    });
  }, [user]);

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-slate-800 bg-slate-900 text-white transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b border-slate-800 px-4',
          collapsed && 'justify-center px-2',
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-slate-900">
          <ShieldCheck className="h-5 w-5" />
        </div>
        {!collapsed && <span className="ml-2 truncate font-semibold">管理后台</span>}
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-1">
          {visibleItems.map((item) => (
            <SidebarNavItem key={item.label} item={item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      <button
        type="button"
        onClick={onToggle}
        className="flex h-10 items-center justify-center border-t border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-white"
        aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </aside>
  );
}

