'use client';

import { ChevronDown, LogOut, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/admin-auth-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function UserMenu() {
  const { user, logout } = useAdminAuth();
  const initials = (user?.name || user?.email || '?').slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-100"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">
            {initials}
          </div>
          <span className="hidden text-slate-700 sm:inline">
            {user?.name || user?.email}
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-1">
          <div className="text-sm font-medium text-slate-900">
            {user?.name || '管理员'}
          </div>
          <div className="truncate text-xs text-slate-500">{user?.email}</div>
          <div className="pt-1">
            <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
              {user?.role}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={cn('cursor-pointer gap-2')}
          onSelect={(e) => e.preventDefault()}
        >
          <UserIcon className="h-4 w-4" />
          个人资料
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn('cursor-pointer gap-2 text-red-600 focus:text-red-600')}
          onSelect={(e) => {
            e.preventDefault();
            logout();
          }}
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

