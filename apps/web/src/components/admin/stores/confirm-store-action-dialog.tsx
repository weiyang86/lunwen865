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
import type { Store } from '@/types/admin/store';

type Action = 'pause' | 'resume' | 'delete';

const META: Record<Action, { title: string; desc: string; confirmText: string; variant: 'default' | 'destructive'; cls?: string }> =
  {
    pause: {
      title: '暂停营业？',
      desc: '暂停后该门店在小程序端将不可下单，可随时恢复。',
      confirmText: '确认暂停',
      variant: 'default',
      cls: 'bg-amber-600 hover:bg-amber-700',
    },
    resume: {
      title: '恢复营业？',
      desc: '门店将立即对外开放下单。',
      confirmText: '确认恢复',
      variant: 'default',
    },
    delete: {
      title: '删除门店？',
      desc: '删除后该门店将被关闭归档，不可下单。该操作不可撤销。',
      confirmText: '确认删除',
      variant: 'destructive',
    },
  };

interface Props {
  open: boolean;
  store: Store | null;
  action: Action | null;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmStoreActionDialog({
  open,
  store,
  action,
  loading,
  onConfirm,
  onClose,
}: Props) {
  if (!open || !store || !action) return null;
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
          <DialogDescription>
            门店：<span className="font-medium text-slate-900">{store.name}</span>
            <br />
            {meta.desc}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button
            variant={meta.variant}
            className={meta.cls}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '提交中…' : meta.confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

