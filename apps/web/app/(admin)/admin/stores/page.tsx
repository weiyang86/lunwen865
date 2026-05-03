'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { UsersPagination } from '@/components/admin/users/users-pagination';
import { ConfirmStoreActionDialog } from '@/components/admin/stores/confirm-store-action-dialog';
import { StoreFilterBar } from '@/components/admin/stores/store-filter-bar';
import { StoreFormDrawer } from '@/components/admin/stores/store-form-drawer';
import { StoreTable } from '@/components/admin/stores/store-table';
import { useStoreList } from '@/hooks/admin/use-store-list';
import { removeStore, updateStoreStatus } from '@/services/admin/stores';
import type { Store } from '@/types/admin/store';

type DrawerMode = 'create' | 'edit' | 'view';
type Action = 'pause' | 'resume' | 'delete';

export default function StoresPage() {
  const { query, setQuery, list, total, loading, error, refetch } = useStoreList();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create');
  const [drawerStoreId, setDrawerStoreId] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<Action | null>(null);
  const [confirmStore, setConfirmStore] = useState<Store | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  function openDrawer(mode: DrawerMode, storeId: string | null) {
    setDrawerMode(mode);
    setDrawerStoreId(storeId);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => setDrawerStoreId(null), 350);
  }

  function openConfirm(action: Action, store: Store) {
    setConfirmAction(action);
    setConfirmStore(store);
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!confirmAction || !confirmStore) return;
    setConfirmLoading(true);
    try {
      if (confirmAction === 'pause') {
        await updateStoreStatus(confirmStore.id, 'PAUSED');
        toast.success('已暂停营业');
      } else if (confirmAction === 'resume') {
        await updateStoreStatus(confirmStore.id, 'OPEN');
        toast.success('已恢复营业');
      } else {
        await removeStore(confirmStore.id);
        toast.success('门店已删除');
      }
      setConfirmOpen(false);
      setConfirmAction(null);
      setConfirmStore(null);
      refetch();
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">门店管理</h1>
          <p className="text-sm text-slate-500">管理门店信息与营业状态</p>
        </div>
        <Button onClick={() => openDrawer('create', null)}>
          <Plus className="h-4 w-4" />
          新增门店
        </Button>
      </div>

      <StoreFilterBar query={query} onChange={setQuery} />

      {error ? (
        <div className="rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <StoreTable
        data={list}
        loading={loading}
        onEdit={(s) => openDrawer('edit', s.id)}
        onView={(s) => openDrawer('view', s.id)}
        onPause={(s) => openConfirm('pause', s)}
        onResume={(s) => openConfirm('resume', s)}
        onDelete={(s) => openConfirm('delete', s)}
      />

      <UsersPagination
        page={query.page}
        pageSize={query.pageSize}
        total={total}
        onChange={(page, pageSize) => setQuery({ ...query, page, pageSize })}
      />

      <StoreFormDrawer
        open={drawerOpen}
        mode={drawerMode}
        storeId={drawerStoreId}
        onClose={closeDrawer}
        onSaved={refetch}
      />

      <ConfirmStoreActionDialog
        open={confirmOpen}
        store={confirmStore}
        action={confirmAction}
        loading={confirmLoading}
        onConfirm={handleConfirm}
        onClose={() => (confirmLoading ? null : setConfirmOpen(false))}
      />
    </div>
  );
}

