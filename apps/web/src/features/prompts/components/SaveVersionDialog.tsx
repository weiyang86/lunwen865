'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PromptDraft, PromptVersion } from '@/types/prompt';
import { computeVersionDiffSummary } from '../utils/versionDiffSummary';

interface Props {
  open: boolean;
  draft: PromptDraft;
  baseVersion: PromptVersion;
  prefillFromVersion?: PromptVersion;
  onClose: () => void;
  onSubmit: (commitMessage: string) => Promise<void>;
}

export function SaveVersionDialog({
  open,
  draft,
  baseVersion,
  prefillFromVersion,
  onClose,
  onSubmit,
}: Props) {
  const [commitMessage, setCommitMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (prefillFromVersion) setCommitMessage(`rollback: 回滚到 v${prefillFromVersion.versionNo}`);
    else setCommitMessage('');
    setSubmitting(false);
  }, [open, prefillFromVersion]);

  const summary = useMemo(() => {
    const source = prefillFromVersion
      ? {
          content: prefillFromVersion.content,
          variables: prefillFromVersion.variables,
          modelConfig: prefillFromVersion.modelConfig,
          metadata: prefillFromVersion.metadata,
        }
      : {
          content: draft.content,
          variables: draft.variables,
          modelConfig: draft.modelConfig,
          metadata: draft.metadata,
        };

    return computeVersionDiffSummary(source, baseVersion);
  }, [baseVersion, draft, prefillFromVersion]);

  const hasDiff = summary.length > 0;
  const commitOk = commitMessage.trim().length > 0 && commitMessage.trim().length <= 200;
  const canSubmit = hasDiff && commitOk && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(commitMessage.trim());
      toast.success('已保存为新版本');
      setCommitMessage('');
      onClose();
    } catch (e: any) {
      toast.error(e?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => (!submitting ? onClose() : null)}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <Dialog.Title className="text-base font-semibold text-slate-900">
                    {prefillFromVersion ? `回滚到 v${prefillFromVersion.versionNo}` : '保存为新版本'}
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    aria-label="关闭"
                    disabled={submitting}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="text-sm font-medium text-slate-900">修改摘要</div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                    {summary.length === 0 ? (
                      <div className="text-slate-500">未检测到修改</div>
                    ) : (
                      <div className="space-y-1">
                        {summary.map((s) => (
                          <div key={s} className="flex items-start gap-2">
                            <span className="text-slate-400">●</span>
                            <span className="text-slate-700">{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-medium text-slate-900">Commit Message</div>
                    <Input
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value.slice(0, 200))}
                      placeholder="1-200 字，描述本次修改的目的"
                      className="h-9"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose} disabled={submitting}>
                    取消
                  </Button>
                  <Button onClick={handleSubmit} disabled={!canSubmit}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {submitting ? '提交中…' : '提交新版本'}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
