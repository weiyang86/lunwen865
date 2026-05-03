'use client';

import type { OrderDetail } from '@/types/admin/order';
import { formatYuanFromFen } from '@/utils/format';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function OrderItemsTable({ order }: { order: OrderDetail }) {
  const total = order.items.reduce((sum, it) => sum + it.subtotal, 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-base font-semibold text-slate-900">商品明细</div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>商品</TableHead>
              <TableHead className="w-28 text-right">单价</TableHead>
              <TableHead className="w-20 text-right">数量</TableHead>
              <TableHead className="w-28 text-right">小计</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>
                  <div className="text-sm text-slate-900">{it.productName}</div>
                  {it.skuName ? (
                    <div className="text-xs text-slate-500">{it.skuName}</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-right text-sm text-slate-700">
                  {formatYuanFromFen(it.unitPrice)}
                </TableCell>
                <TableCell className="text-right text-sm text-slate-700">
                  {it.quantity}
                </TableCell>
                <TableCell className="text-right text-sm font-medium text-slate-900">
                  {formatYuanFromFen(it.subtotal)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3} className="text-right text-sm text-slate-500">
                合计
              </TableCell>
              <TableCell className="text-right text-sm font-semibold text-slate-900">
                {formatYuanFromFen(total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

