'use client';

import { Image as ImageIcon, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle, Package } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductStatusBadge } from './product-status-badge';
import type { ProductListItem } from '@/types/admin/product';
import { formatDateTime, formatYuanFromFen } from '@/utils/format';
import { cn } from '@/lib/utils';

interface Props {
  data: ProductListItem[];
  loading: boolean;
  selectedIds: Set<string>;
  allSelectedInPage: boolean;
  someSelectedInPage: boolean;
  onToggleSelectAllInPage: () => void;
  onToggleSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onToggleStatus: (p: ProductListItem) => void;
  onRemove: (p: ProductListItem) => void;
}

function priceText(p: ProductListItem) {
  if (p.minPrice === p.maxPrice) return formatYuanFromFen(p.minPrice);
  return `${formatYuanFromFen(p.minPrice)} - ${formatYuanFromFen(p.maxPrice)}`;
}

export function ProductTable({
  data,
  loading,
  selectedIds,
  allSelectedInPage,
  someSelectedInPage,
  onToggleSelectAllInPage,
  onToggleSelect,
  onCreate,
  onEdit,
  onToggleStatus,
  onRemove,
}: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-white">
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={allSelectedInPage}
                  ref={(el) => {
                    if (!el) return;
                    el.indeterminate = !allSelectedInPage && someSelectedInPage;
                  }}
                  onChange={onToggleSelectAllInPage}
                />
              </TableHead>
              <TableHead>商品</TableHead>
              <TableHead className="w-40">价格</TableHead>
              <TableHead className="w-28 text-right">库存</TableHead>
              <TableHead className="w-24 text-right">销量</TableHead>
              <TableHead className="w-24">状态</TableHead>
              <TableHead className="w-44">更新时间</TableHead>
              <TableHead className="w-44 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && data.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-slate-600">
                    <Package className="h-10 w-10 text-slate-400" />
                    <div className="text-sm">该分类暂无商品</div>
                    <Button onClick={onCreate}>新增商品</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((p) => {
                const selected = selectedIds.has(p.id);
                const canToggle = p.status !== 'DRAFT';
                return (
                  <TableRow key={p.id} className="hover:bg-slate-50">
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelect(p.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-slate-100">
                          {p.coverUrl ? (
                            <img
                              src={p.coverUrl}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {p.name}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {p.categoryName}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{priceText(p)}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right text-sm',
                        p.totalStock === 0 ? 'font-semibold text-rose-600' : 'text-slate-700',
                      )}
                    >
                      {p.totalStock}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-700">
                      {p.soldCount}
                    </TableCell>
                    <TableCell>
                      <ProductStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatDateTime(p.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(p.id)}>
                        <Pencil className="h-4 w-4" />
                        编辑
                      </Button>
                      {canToggle ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleStatus(p)}
                          className={cn(
                            p.status === 'ON_SALE'
                              ? 'text-slate-600 hover:text-slate-700'
                              : 'text-emerald-600 hover:text-emerald-700',
                          )}
                        >
                          {p.status === 'ON_SALE' ? (
                            <ArrowDownCircle className="h-4 w-4" />
                          ) : (
                            <ArrowUpCircle className="h-4 w-4" />
                          )}
                          {p.status === 'ON_SALE' ? '下架' : '上架'}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => onRemove(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
