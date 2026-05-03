'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Action = 'FULFILLING' | 'COMPLETED' | 'CANCELLED';

const META: Record<Action, { title: string; desc: string; confirmVariant: 'default' | 'destructive' }> =
  {
    FULFILLING: {
      title: '标记发货？',
      desc: '订单将进入履约状态，确定继续吗？',
      confirmVariant: 'default',
    },
    COMPLETED: {
      title: '标记完成？',
      desc: '完成后订单不可再修改。',
      confirmVariant: 'default',
    },
    CANCELLED: {
      title: '取消订单？',
      desc: '取消后订单不可恢复。',
      confirmVariant: 'destructive',
    },
  };

interface Props {
  open: boolean;
  action: Action | null;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmStatusDialog({ open, action, loading, onConfirm, onClose }: Props) {
  if (!action) return null;
  const meta = META[action];

  return (
    <Dialog open={open} onOpenChange={(v) => (!loading ? (v ? null : onClose()) : null)}>
      <DialogContent
        className="sm:max-w-sm"
        onPointerDownOutside={(e) => {
          if (loading) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (loading) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>{meta.desc}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button variant={meta.confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading ? '提交中…' : '确认'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
