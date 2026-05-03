'use client';

import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updateUserStatus } from '@/services/admin/users';
import type { AdminUser } from '@/types/admin/user';

interface Props {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export function ConfirmStatusDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!user) return null;
  const userId = user.id;
  const willDisable = user.status === 'ACTIVE';
  const next = willDisable ? 'DISABLED' : 'ACTIVE';

  async function handleConfirm() {
    setSubmitting(true);
    setErr(null);
    try {
      await updateUserStatus(userId, next);
      onSuccess();
      onOpenChange(false);
    } catch (e: unknown) {
      const msg =
        (e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : null) || '操作失败';
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setErr(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {willDisable ? '确认停用该用户？' : '确认启用该用户？'}
          </DialogTitle>
          <DialogDescription>
            手机号：<span className="font-mono">{user.phone || '-'}</span>
            <br />
            {willDisable
              ? '停用后该用户将无法登录小程序。'
              : '启用后该用户将恢复正常使用。'}
          </DialogDescription>
        </DialogHeader>

        {err && (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            variant={willDisable ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? '提交中…' : '确认'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
