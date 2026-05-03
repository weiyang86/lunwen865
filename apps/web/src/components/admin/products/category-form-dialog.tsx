'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Category, CategoryUpsertPayload } from '@/types/admin/category';

type Mode = 'create' | 'edit';

interface Props {
  open: boolean;
  mode: Mode;
  parent: Category | null;
  current: Category | null;
  loading: boolean;
  onSubmit: (payload: CategoryUpsertPayload) => void;
  onClose: () => void;
}

export function CategoryFormDialog({
  open,
  mode,
  parent,
  current,
  loading,
  onSubmit,
  onClose,
}: Props) {
  const [name, setName] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    if (mode === 'edit' && current) {
      setName(current.name ?? '');
      setIconUrl(current.iconUrl ?? '');
    } else {
      setName('');
      setIconUrl('');
    }
  }, [open, mode, current]);

  const parentLabel = useMemo(() => {
    if (mode === 'edit') return parent?.name ?? '根分类';
    return parent?.name ?? '根分类';
  }, [mode, parent]);

  function handleConfirm() {
    setErr(null);
    const n = name.trim();
    if (n.length < 2 || n.length > 20) {
      setErr('名称需为 2-20 字');
      return;
    }
    onSubmit({
      parentId: mode === 'create' ? parent?.id ?? null : current?.parentId ?? null,
      name: n,
      iconUrl: iconUrl.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!loading ? (v ? null : onClose()) : null)}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (loading) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (loading) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增分类' : '编辑分类'}</DialogTitle>
          <DialogDescription>父分类：{parentLabel}</DialogDescription>
        </DialogHeader>

        {err ? (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-700">
              名称 <span className="text-rose-500">*</span>
            </div>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-700">图标 URL</div>
            <Input
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              disabled={loading}
              placeholder="https://..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? '提交中…' : '确认'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

