'use client';

import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types/admin/order';
import { STATUS_META } from './order-status-badge';

type TabValue = 'ALL' | OrderStatus;

interface Props {
  value: TabValue;
  counts?: Partial<Record<TabValue, number>>;
  onChange: (v: TabValue) => void;
}

const ORDERED_TABS: Array<{ value: TabValue; label: string }> = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING_PAYMENT', label: STATUS_META.PENDING_PAYMENT.label },
  { value: 'PAID', label: STATUS_META.PAID.label },
  { value: 'FULFILLING', label: STATUS_META.FULFILLING.label },
  { value: 'COMPLETED', label: STATUS_META.COMPLETED.label },
  { value: 'CANCELLED', label: STATUS_META.CANCELLED.label },
  { value: 'REFUNDING', label: STATUS_META.REFUNDING.label },
  { value: 'REFUNDED', label: STATUS_META.REFUNDED.label },
];

function formatCount(n: number) {
  if (n > 99) return '99+';
  return String(n);
}

export function OrderStatusTabs({ value, counts, onChange }: Props) {
  return (
    <div className="border-b border-slate-200">
      <div className="flex items-center gap-1 overflow-x-auto px-2">
        {ORDERED_TABS.map((t) => {
          const active = t.value === value;
          const c = counts?.[t.value] ?? 0;
          const showCount = c >= 1;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className={cn(
                'relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm',
                active
                  ? 'font-semibold text-indigo-600'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <span>{t.label}</span>
              {showCount && (
                <span
                  className={cn(
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs',
                    active ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {formatCount(c)}
                </span>
              )}
              {active && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-indigo-600" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

