'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { fetchUsers } from '@/services/admin/users';
import type { AdminUser, ListUsersQuery } from '@/types/admin/user';

export type PickedTutor = { id: string; name: string; email: string | null };

export function buildTutorPickerQuery(args: { search: string }): ListUsersQuery {
  return {
    page: 1,
    pageSize: 20,
    keyword: args.search.trim() ? args.search.trim() : undefined,
    role: 'TUTOR',
  };
}

export async function performTutorPick(args: {
  tutorId: string;
  onPicked: (tutor: PickedTutor) => void;
}): Promise<void> {
  args.onPicked({ id: args.tutorId, name: args.tutorId, email: null });
}

function toPickedTutor(u: AdminUser): PickedTutor {
  const nickname = (u as any).nickname ?? null;
  const email = (u as any).email ?? null;
  const phone = (u as any).phone ?? null;
  const name = (nickname || email || phone || u.id) as string;
  return { id: u.id, name, email: email ?? null };
}

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  onPicked: (tutor: PickedTutor) => void;
};

export function TutorPickerDialog({
  open,
  onClose,
  title = '选择导师',
  description = '仅显示角色为 TUTOR 的用户',
  onPicked,
}: Props) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<PickedTutor[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);

  const [manualTutorId, setManualTutorId] = useState('');
  const canSubmitManual = useMemo(() => Boolean(manualTutorId.trim()), [manualTutorId]);

  const canSubmit = useMemo(
    () => Boolean(selectedTutorId) && !loading && !submitting,
    [selectedTutorId, loading, submitting],
  );

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchUsers(buildTutorPickerQuery({ search }));
      const list = Array.isArray((res as any).items) ? ((res as any).items as AdminUser[]) : [];
      setItems(list.map(toPickedTutor));
      setSelectedTutorId(null);
    } catch {
      setItems([]);
      setErr('导师列表加载失败，可使用下方手动输入导师用户ID');
    } finally {
      setLoading(false);
    }
  }, [open, search]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      void load();
    }, 300);
    return () => clearTimeout(t);
  }, [open, load]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setItems([]);
      setErr(null);
      setSelectedTutorId(null);
      setManualTutorId('');
      setLoading(false);
      setSubmitting(false);
    }
  }, [open]);

  async function submit(tutor: PickedTutor) {
    setSubmitting(true);
    try {
      onPicked(tutor);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="按手机号 / 昵称 / 邮箱搜索"
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          {err ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {err}
            </div>
          ) : null}

          <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white">
            {loading ? (
              <div className="flex h-36 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-slate-500">暂无导师</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((t) => {
                  const selected = selectedTutorId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTutorId(t.id)}
                      className={cn(
                        'flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-slate-50',
                        selected ? 'bg-indigo-50' : '',
                      )}
                    >
                      <div
                        className={cn(
                          'mt-1 h-4 w-4 rounded-full border',
                          selected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">
                          {t.name || '—'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          <span className="font-mono">{t.id}</span>
                          {t.email ? <span className="ml-2">{t.email}</span> : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <details className="rounded-md border border-slate-200 bg-white">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm text-slate-700">
              手动输入导师用户ID
            </summary>
            <div className="space-y-3 px-3 pb-3">
              <input
                value={manualTutorId}
                onChange={(e) => setManualTutorId(e.target.value)}
                placeholder="粘贴导师用户ID（降级用）"
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  disabled={!canSubmitManual || submitting}
                  onClick={async () =>
                    submit({ id: manualTutorId.trim(), name: manualTutorId.trim(), email: null })
                  }
                >
                  确认选择
                </Button>
              </div>
            </div>
          </details>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => {
              const picked = items.find((x) => x.id === selectedTutorId) ?? null;
              if (!picked) return;
              void submit(picked);
            }}
          >
            确认选择
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
