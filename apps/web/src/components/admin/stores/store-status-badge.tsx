'use client';

import { cn } from '@/lib/utils';
import type { StoreStatus } from '@/types/admin/store';

const META: Record<StoreStatus, { label: string; cls: string }> = {
  OPEN: { label: '营业中', cls: 'bg-emerald-100 text-emerald-700' },
  PAUSED: { label: '已暂停', cls: 'bg-amber-100 text-amber-700' },
  CLOSED: { label: '已关闭', cls: 'bg-slate-100 text-slate-600' },
};

export function StoreStatusBadge({ status }: { status: StoreStatus }) {
  const m = META[status];
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}
