'use client';

import { Copy, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { OrderDetail } from '@/types/admin/order';

function initialsOf(user: { nickname: string | null; phone: string | null }) {
  const src = (user.nickname || user.phone || '?').trim();
  return src.slice(0, 1).toUpperCase();
}

export function OrderUserSection({ order }: { order: OrderDetail }) {
  const phone = order.user.phone || '';

  async function copyPhone() {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      toast.success('手机号已复制');
    } catch {
      toast.error('复制失败');
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-base font-semibold text-slate-900">用户信息</div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => console.log('TODO link to user', order.user)}
        >
          查看用户
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-sm font-medium text-white">
          {order.user.avatar ? (
            <img
              alt={order.user.nickname || order.user.phone || 'user'}
              src={order.user.avatar}
              className="h-full w-full object-cover"
            />
          ) : (
            initialsOf(order.user)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-900">
            {order.user.nickname || '—'}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono">{phone || '—'}</span>
            {phone ? (
              <button
                type="button"
                onClick={copyPhone}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900"
              >
                <Copy className="h-3.5 w-3.5" />
                复制
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <UserIcon className="h-3.5 w-3.5" />
                无手机号
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

