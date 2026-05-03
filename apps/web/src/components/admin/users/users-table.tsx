'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { UserStatusBadge } from './user-status-badge';
import type { AdminUser } from '@/types/admin/user';

interface Props {
  data: AdminUser[];
  loading: boolean;
  page: number;
  pageSize: number;
  selectedIds: Set<string>;
  onSelectedIdsChange: (next: Set<string>) => void;
  onView: (u: AdminUser) => void;
  onToggleStatus: (u: AdminUser) => void;
}

function formatDate(s?: string | null) {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function UsersTable({
  data,
  loading,
  page,
  pageSize,
  selectedIds,
  onSelectedIdsChange,
  onView,
  onToggleStatus,
}: Props) {
  const visibleIds = data.map((u) => u.id);
  const selectedVisibleCount = visibleIds.reduce((acc, id) => acc + (selectedIds.has(id) ? 1 : 0), 0);
  const allChecked = data.length > 0 && selectedVisibleCount === data.length;
  const headerChecked: boolean | 'indeterminate' =
    selectedVisibleCount === 0 ? false : allChecked ? true : 'indeterminate';

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={headerChecked}
                aria-label="全选"
                onCheckedChange={(v) => {
                  const checked = v === true;
                  if (data.length === 0) return;
                  const next = new Set(selectedIds);
                  for (const id of visibleIds) {
                    if (checked) next.add(id);
                    else next.delete(id);
                  }
                  onSelectedIdsChange(next);
                }}
              />
            </TableHead>
            <TableHead className="w-16">序号</TableHead>
            <TableHead className="w-52">用户ID</TableHead>
            <TableHead className="w-48">手机号</TableHead>
            <TableHead>昵称</TableHead>
            <TableHead>邮箱</TableHead>
            <TableHead className="w-24">状态</TableHead>
            <TableHead className="w-44">注册时间</TableHead>
            <TableHead className="w-44">最后登录</TableHead>
            <TableHead className="w-40 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && data.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 10 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={10}
                className="py-12 text-center text-muted-foreground"
              >
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            data.map((u, idx) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(u.id)}
                    aria-label="选择用户"
                    onCheckedChange={(v) => {
                      const checked = v === true;
                      const next = new Set(selectedIds);
                      if (checked) next.add(u.id);
                      else next.delete(u.id);
                      onSelectedIdsChange(next);
                    }}
                  />
                </TableCell>
                <TableCell className="font-mono text-slate-700">
                  {(page - 1) * pageSize + idx + 1}
                </TableCell>
                <TableCell className="max-w-xs truncate font-mono">{u.id}</TableCell>
                <TableCell className="font-mono">{u.phone || '-'}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {u.nickname || '-'}
                </TableCell>
                <TableCell className="max-w-xs truncate">{u.email || '-'}</TableCell>
                <TableCell>
                  <UserStatusBadge status={u.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(u.createdAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(u.lastLoginAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => onView(u)}>
                    查看
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={
                      u.status === 'ACTIVE'
                        ? 'text-rose-600 hover:text-rose-700'
                        : 'text-emerald-600 hover:text-emerald-700'
                    }
                    onClick={() => onToggleStatus(u)}
                  >
                    {u.status === 'ACTIVE' ? '停用' : '启用'}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
