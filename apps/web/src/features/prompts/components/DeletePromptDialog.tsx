'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { promptApi } from '@/api/prompts';
import type { PromptTemplate } from '@/types/prompt';

interface Props {
  open: boolean;
  row: PromptTemplate | null;
  onOpenChange: (v: boolean) => void;
  onDeleted: () => void;
}

export function DeletePromptDialog({ open, row, onOpenChange, onDeleted }: Props) {
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfirm('');
    setErr(null);
  }, [open]);

  const canSubmit = useMemo(() => {
    if (!row) return false;
    return confirm === row.sceneKey && !submitting;
  }, [confirm, row, submitting]);

  async function handleDelete() {
    if (!row) return;
    setSubmitting(true);
    setErr(null);
    try {
      await promptApi.remove(row.id);
      toast.success(`已删除模板 ${row.name}`);
      onOpenChange(false);
      onDeleted();
    } catch (e: any) {
      setErr(e?.message || '删除失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (!submitting ? onOpenChange(v) : null)}>
      <DialogContent
        className="mx-4 sm:mx-0 sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (submitting) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (submitting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-rose-600" />
            删除 Prompt 模板？
          </DialogTitle>
          <DialogDescription>
            模板：{row.name}
            <br />
            sceneKey：<span className="font-mono">{row.sceneKey}</span>（业务调用方将立即失效）
            <br />
            <br />
            此操作不可恢复，请确认相关业务已下线。
          </DialogDescription>
        </DialogHeader>

        {err ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="text-sm text-slate-700">请输入 sceneKey 以确认删除：</div>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={submitting}
            className="h-9 font-mono"
            placeholder={row.sceneKey}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!canSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? '删除中…' : '确认删除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

