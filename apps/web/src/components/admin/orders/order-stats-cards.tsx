'use client';

import { CreditCard, Receipt, TrendingUp, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderStats } from '@/types/admin/order';
import { formatYuanFromFen } from '@/utils/format';

interface Props {
  stats: OrderStats | null;
  loading: boolean;
}

function Card({
  label,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  icon: typeof Receipt;
  tone: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="text-sm text-slate-500">{label}</div>
        <div
          className={cn('flex h-9 w-9 items-center justify-center rounded-md', tone)}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="h-7 w-24 animate-pulse rounded bg-slate-100" />
        ) : (
          <div className="text-2xl font-semibold text-slate-900">{value}</div>
        )}
      </div>
    </div>
  );
}

export function OrderStatsCards({ stats, loading }: Props) {
  const safe = stats ?? { total: 0, paid: 0, refunded: 0, revenue: 0 };
  const showDash = !loading && !stats;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card
        label="订单总数"
        value={showDash ? '—' : String(safe.total)}
        icon={Receipt}
        tone="bg-indigo-50 text-indigo-600"
        loading={loading}
      />
      <Card
        label="已支付"
        value={showDash ? '—' : String(safe.paid)}
        icon={CreditCard}
        tone="bg-blue-50 text-blue-600"
        loading={loading}
      />
      <Card
        label="营收（元）"
        value={showDash ? '—' : formatYuanFromFen(safe.revenue)}
        icon={TrendingUp}
        tone="bg-emerald-50 text-emerald-600"
        loading={loading}
      />
      <Card
        label="已退款"
        value={showDash ? '—' : String(safe.refunded)}
        icon={Undo2}
        tone="bg-rose-50 text-rose-600"
        loading={loading}
      />
    </div>
  );
}

