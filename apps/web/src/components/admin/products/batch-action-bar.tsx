'use client';

import { Trash2, X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Props {
  count: number;
  visible: boolean;
  onBatchOnSale: () => void;
  onBatchOffShelf: () => void;
  onBatchRemove: () => void;
  onClear: () => void;
}

export function BatchActionBar({
  count,
  visible,
  onBatchOnSale,
  onBatchOffShelf,
  onBatchRemove,
  onClear,
}: Props) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 px-4 pb-4 transition-transform duration-200',
        visible ? 'translate-y-0' : 'translate-y-24',
      )}
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="text-sm text-slate-700">
          已选 <span className="font-semibold text-slate-900">{count}</span> 项
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBatchOnSale}>
            <ArrowUpCircle className="h-4 w-4" />
            批量上架
          </Button>
          <Button variant="outline" size="sm" onClick={onBatchOffShelf}>
            <ArrowDownCircle className="h-4 w-4" />
            批量下架
          </Button>
          <Button variant="destructive" size="sm" onClick={onBatchRemove}>
            <Trash2 className="h-4 w-4" />
            批量删除
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-4 w-4" />
            清除选择
          </Button>
        </div>
      </div>
    </div>
  );
}

