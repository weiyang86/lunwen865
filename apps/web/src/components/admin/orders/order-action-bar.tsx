'use client';

import { CheckCircle2, PackageCheck, Undo2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OrderDetail, Refund } from '@/types/admin/order';

interface Props {
  order: OrderDetail;
  onStatusAction: (action: 'FULFILLING' | 'COMPLETED' | 'CANCELLED') => void;
  onCreateRefund: () => void;
  onResolveRefund: (refund: Refund, preset?: 'APPROVED' | 'REJECTED') => void;
}

export function OrderActionBar({ order, onStatusAction, onCreateRefund, onResolveRefund }: Props) {
  const pendingRefund = order.refunds.find((r) => r.status === 'PENDING') ?? null;

  if (order.status === 'PENDING_PAYMENT') {
    return (
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          className="text-rose-600 hover:text-rose-700"
          onClick={() => onStatusAction('CANCELLED')}
        >
          <XCircle className="h-4 w-4" />
          取消订单
        </Button>
        <div className="text-xs text-slate-500">支付未完成，可取消订单</div>
      </div>
    );
  }

  if (order.status === 'PAID') {
    return (
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={onCreateRefund}>
          <Undo2 className="h-4 w-4" />
          发起退款
        </Button>
        <Button onClick={() => onStatusAction('FULFILLING')}>
          <PackageCheck className="h-4 w-4" />
          标记发货
        </Button>
      </div>
    );
  }

  if (order.status === 'FULFILLING') {
    return (
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={onCreateRefund}>
          <Undo2 className="h-4 w-4" />
          发起退款
        </Button>
        <Button onClick={() => onStatusAction('COMPLETED')}>
          <CheckCircle2 className="h-4 w-4" />
          标记完成
        </Button>
      </div>
    );
  }

  if (order.status === 'REFUNDING') {
    if (pendingRefund) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="destructive"
            onClick={() => onResolveRefund(pendingRefund, 'REJECTED')}
          >
            <XCircle className="h-4 w-4" />
            拒绝退款
          </Button>
          <Button onClick={() => onResolveRefund(pendingRefund, 'APPROVED')}>
            <CheckCircle2 className="h-4 w-4" />
            通过退款
          </Button>
        </div>
      );
    }
    return <div className="text-sm text-slate-500">等待审批</div>;
  }

  return <div className="text-sm text-slate-500">该订单已结束，无可执行操作</div>;
}
