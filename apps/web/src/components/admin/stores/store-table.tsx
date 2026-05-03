'use client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Store } from '@/types/admin/store';
import { formatDateTime } from '@/utils/format';
import { StoreStatusBadge } from './store-status-badge';

interface Props {
  data: Store[];
  loading: boolean;
  onEdit: (s: Store) => void;
  onView: (s: Store) => void;
  onPause: (s: Store) => void;
  onResume: (s: Store) => void;
  onDelete: (s: Store) => void;
}

export function StoreTable({
  data,
  loading,
  onEdit,
  onView,
  onPause,
  onResume,
  onDelete,
}: Props) {
  return (
    <div className="rounded-lg border bg-white">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">门店编码</TableHead>
              <TableHead className="min-w-44">门店名称</TableHead>
              <TableHead className="w-24">状态</TableHead>
              <TableHead className="min-w-80">地址</TableHead>
              <TableHead className="w-36">联系电话</TableHead>
              <TableHead className="w-28">店长</TableHead>
              <TableHead className="w-44">创建时间</TableHead>
              <TableHead className="w-56 text-right">操作</TableHead>
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
                <TableCell colSpan={8} className="py-14 text-center text-muted-foreground">
                  暂无门店
                </TableCell>
              </TableRow>
            ) : (
              data.map((s) => (
                <TableRow key={s.id} className="hover:bg-slate-50">
                  <TableCell className="font-mono text-sm">{s.code}</TableCell>
                  <TableCell className="text-slate-900">{s.name}</TableCell>
                  <TableCell>
                    <StoreStatusBadge status={s.status} />
                  </TableCell>
                  <TableCell>
                    <span className="block max-w-xl truncate text-sm text-slate-700" title={s.address}>
                      {s.address}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-700">
                    {s.phone || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {s.managerName || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {formatDateTime(s.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {s.status === 'CLOSED' ? (
                      <Button variant="ghost" size="sm" onClick={() => onView(s)}>
                        查看
                      </Button>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => onEdit(s)}>
                          编辑
                        </Button>
                        {s.status === 'OPEN' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-700 hover:text-amber-800"
                            onClick={() => onPause(s)}
                          >
                            暂停营业
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-700 hover:text-emerald-800"
                            onClick={() => onResume(s)}
                          >
                            恢复营业
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() => onDelete(s)}
                        >
                          删除
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

