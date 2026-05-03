'use client';

import { useEffect, useState } from 'react';

import { useUsers } from '@/hooks/admin/use-users';
import { ConfirmStatusDialog } from '@/components/admin/users/confirm-status-dialog';
import { UserDetailDrawer } from '@/components/admin/users/user-detail-drawer';
import { UsersPagination } from '@/components/admin/users/users-pagination';
import { UsersTable } from '@/components/admin/users/users-table';
import { UsersToolbar } from '@/components/admin/users/users-toolbar';
import type { AdminUser } from '@/types/admin/user';

export default function UsersPage() {
  const { data, loading, error, query, setQuery, reload } = useUsers();

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [confirmUser, setConfirmUser] = useState<AdminUser | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set());
  }, [query.page, query.pageSize]);

  function handleView(u: AdminUser) {
    setDrawerId(u.id);
    setDrawerOpen(true);
  }

  function handleToggle(u: AdminUser) {
    setConfirmUser(u);
    setConfirmOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">用户管理</h1>
      </div>

      <UsersToolbar
        query={query}
        onChange={setQuery}
        onReload={reload}
        loading={loading}
      />

      {error && (
        <div className="rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <UsersTable
        data={data?.items ?? []}
        loading={loading}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 20}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onView={handleView}
        onToggleStatus={handleToggle}
      />

      <UsersPagination
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 20}
        total={data?.total ?? 0}
        onChange={(page, pageSize) => setQuery({ ...query, page, pageSize })}
      />

      <UserDetailDrawer
        userId={drawerId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      <ConfirmStatusDialog
        user={confirmUser}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onSuccess={reload}
      />
    </div>
  );
}
