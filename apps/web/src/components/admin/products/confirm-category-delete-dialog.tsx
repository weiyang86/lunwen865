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
import type { Category } from '@/types/admin/category';

interface Props {
  open: boolean;
  category: Category | null;
  disabledReason: string | null;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmCategoryDeleteDialog({
  open,
  category,
  disabledReason,
  loading,
  onConfirm,
  onClose,
}: Props) {
  if (!open || !category) return null;
  const disabled = Boolean(disabledReason);

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
          <DialogTitle>删除分类？</DialogTitle>
          <DialogDescription>
            即将删除分类“{category.name}”。
            {category.productCount > 0 ? (
              <span className="mt-2 block text-rose-700">
                分类下仍有 {category.productCount} 个商品，无法删除
              </span>
            ) : null}
            {disabledReason && category.productCount === 0 ? (
              <span className="mt-2 block text-rose-700">{disabledReason}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading || disabled}
          >
            {loading ? '删除中…' : '确认删除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

