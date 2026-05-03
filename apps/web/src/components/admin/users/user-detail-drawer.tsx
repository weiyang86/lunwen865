'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { fetchUser } from '@/services/admin/users';
import type { AdminUserDetail } from '@/types/admin/user';
import { UserStatusBadge } from './user-status-badge';

interface Props {
  userId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function fmt(s?: string | null) {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-b py-3 last:border-b-0">
      <div className="w-24 shrink-0 text-sm text-muted-foreground">{label}</div>
      <div className="flex-1 break-all text-sm">{children}</div>
    </div>
  );
}

export function UserDetailDrawer({ userId, open, onOpenChange }: Props) {
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    fetchUser(userId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>用户详情</SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          {loading || !data ? (
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div>
              <Row label="用户 ID">
                <span className="font-mono text-xs">{data.id}</span>
              </Row>
              <Row label="手机号">
                <span className="font-mono">{data.phone || '-'}</span>
              </Row>
              <Row label="昵称">{data.nickname || '-'}</Row>
              <Row label="邮箱">{data.email || '-'}</Row>
              <Row label="状态">
                <UserStatusBadge status={data.status} />
              </Row>
              <Row label="注册时间">{fmt(data.createdAt)}</Row>
              <Row label="最后登录">{fmt(data.lastLoginAt)}</Row>
              {typeof data._count?.orders === 'number' && (
                <Row label="订单数">{data._count.orders}</Row>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
