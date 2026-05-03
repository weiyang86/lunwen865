'use client';

import { cn } from '@/lib/utils';
import type { ProductStatus } from '@/types/admin/product';

const META: Record<ProductStatus, { label: string; cls: string }> = {
  ON_SALE: { label: '在售', cls: 'bg-emerald-100 text-emerald-700' },
  OFF_SHELF: { label: '已下架', cls: 'bg-slate-100 text-slate-600' },
  DRAFT: { label: '草稿', cls: 'bg-blue-100 text-blue-700' },
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
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

