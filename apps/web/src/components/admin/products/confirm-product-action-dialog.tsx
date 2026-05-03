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

type Action =
  | { type: 'toggle'; id: string; next: 'ON_SALE' | 'OFF_SHELF'; name: string }
  | { type: 'remove'; id: string; name: string }
  | { type: 'batch-toggle'; next: 'ON_SALE' | 'OFF_SHELF'; count: number }
  | { type: 'batch-remove'; count: number };

function titleOf(a: Action) {
  if (a.type === 'toggle') return a.next === 'ON_SALE' ? '确认上架？' : '确认下架？';
  if (a.type === 'remove') return '确认删除？';
  if (a.type === 'batch-toggle') return a.next === 'ON_SALE' ? '批量上架？' : '批量下架？';
  return '批量删除？';
}

function descOf(a: Action) {
  if (a.type === 'toggle') return `商品：${a.name}`;
  if (a.type === 'remove') return `商品：${a.name}`;
  if (a.type === 'batch-toggle') return `已选 ${a.count} 项`;
  return `已选 ${a.count} 项`;
}

function confirmVariant(a: Action) {
  if (a.type === 'toggle') return a.next === 'ON_SALE' ? 'default' : 'default';
  if (a.type === 'batch-toggle') return 'default';
  return 'destructive';
}

interface Props {
  open: boolean;
  action: Action | null;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmProductActionDialog({
  open,
  action,
  loading,
  onConfirm,
  onClose,
}: Props) {
  if (!open || !action) return null;

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
          <DialogTitle>{titleOf(action)}</DialogTitle>
          <DialogDescription>{descOf(action)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button
            variant={confirmVariant(action)}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '处理中…' : '确认'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { Action as ProductConfirmAction };
