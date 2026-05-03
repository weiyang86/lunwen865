'use client';

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

import { promptApi } from '@/api/prompts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { PromptVersion } from '@/types/prompt';
import { PromptVersionDiffDialog } from './PromptVersionDiffDialog';
import { PromptVersionListItem } from './PromptVersionListItem';

interface Props {
  open: boolean;
  promptId: string;
  baseVersion: PromptVersion | null;
  hasDraft: boolean;
  onClose: () => void;
  onSetBaseline: (v: PromptVersion) => Promise<void> | void;
  onRequestRollback: (v: PromptVersion) => void;
}

function formatRelativeTimeStrict(s: string): string {
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return '-';
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '刚刚';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function highlight(text: string, keyword: string) {
  const k = keyword.trim();
  if (!k) return text;
  const lower = text.toLowerCase();
  const needle = k.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + k.length);
  const after = text.slice(idx + k.length);
  return (
    <>
      {before}
      <mark className="bg-yellow-200">{match}</mark>
      {after}
    </>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  danger,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
              <Dialog.Panel className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
                <Dialog.Title className="text-base font-semibold text-slate-900">{title}</Dialog.Title>
                <div className="mt-3 text-sm text-slate-700">{description}</div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>
                    取消
                  </Button>
                  <Button
                    onClick={onConfirm}
                    className={cn(danger ? 'bg-rose-600 text-white hover:bg-rose-700' : '')}
                  >
                    {confirmText}
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

export function PromptVersionDrawer({
  open,
  promptId,
  baseVersion,
  hasDraft,
  onClose,
  onSetBaseline,
  onRequestRollback,
}: Props) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const [diffOpen, setDiffOpen] = useState(false);
  const [diffA, setDiffA] = useState<PromptVersion | null>(null);
  const [diffB, setDiffB] = useState<PromptVersion | null>(null);

  const [baselineTarget, setBaselineTarget] = useState<PromptVersion | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<PromptVersion | null>(null);

  const canCompareMore = compareIds.length < 2;

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return versions;
    return versions.filter((v) => {
      const msg = (v.changelog ?? '').toLowerCase();
      const author = (v.createdBy?.name ?? '').toLowerCase();
      return msg.includes(k) || author.includes(k);
    });
  }, [keyword, versions]);

  const loadPage = useCallback(async (nextCursor: string | null) => {
    setLoading(true);
    try {
      const r = await promptApi.listVersions({
        templateId: promptId,
        cursor: nextCursor ?? undefined,
        limit: 20,
      });
      setVersions((prev) => (nextCursor ? [...prev, ...r.items] : r.items));
      setCursor(r.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [promptId]);

  useEffect(() => {
    if (!open) return;
    setVersions([]);
    setCursor(null);
    setKeyword('');
    setCompareIds([]);
    setDiffOpen(false);
    setDiffA(null);
    setDiffB(null);
    setBaselineTarget(null);
    setRollbackTarget(null);
    void loadPage(null);
  }, [loadPage, open]);

  useEffect(() => {
    if (open) return;
    setKeyword('');
    setCompareIds([]);
    setBaselineTarget(null);
    setRollbackTarget(null);
    setDiffOpen(false);
    setDiffA(null);
    setDiffB(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (diffOpen) return;
    setCompareIds([]);
  }, [diffOpen, open]);

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  useEffect(() => {
    if (compareIds.length !== 2) return;
    const a = versions.find((v) => v.id === compareIds[0]);
    const b = versions.find((v) => v.id === compareIds[1]);
    if (!a || !b) return;
    setDiffA(a);
    setDiffB(b);
    setDiffOpen(true);
  }, [compareIds, versions]);

  const compareIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < compareIds.length; i += 1) map.set(compareIds[i], i + 1);
    return map;
  }, [compareIds]);

  return (
    <>
      <Transition appear show={open} as={Fragment}>
        <Dialog as="div" className="relative z-40" onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-stretch justify-end">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="ease-in duration-150"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="w-full max-w-md border-l border-slate-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-200 p-4">
                    <Dialog.Title className="text-base font-semibold text-slate-900">
                      版本历史
                    </Dialog.Title>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100"
                      aria-label="关闭"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-4">
                    <Input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="搜索 commit message..."
                      className="h-9"
                    />

                    <div className="mt-4 space-y-3">
                      {baseVersion ? (
                        <div className="text-xs text-slate-400">
                          ━━━ 当前基线（v{baseVersion.versionNo}） ━━━
                        </div>
                      ) : null}
                      {loading && versions.length === 0 ? (
                        <div className="space-y-3">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div
                              key={i}
                              className="animate-pulse rounded-lg border border-slate-200 bg-white p-3"
                            >
                              <div className="h-4 w-24 rounded bg-slate-100" />
                              <div className="mt-3 h-4 w-full rounded bg-slate-100" />
                              <div className="mt-2 h-3 w-40 rounded bg-slate-100" />
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {!loading && filtered.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500">暂无历史版本</div>
                      ) : null}

                      {filtered.map((v) => {
                        const isCurrent = !!baseVersion && baseVersion.id === v.id;
                        const compareIndex = compareIndexMap.get(v.id) ?? null;
                        const author = v.createdBy?.name ?? '—';
                        const time = formatRelativeTimeStrict(v.createdAt);
                        const metaText = `${author} · ${time}`;
                        const commitNode = highlight(v.changelog || '—', keyword);
                        return (
                          <PromptVersionListItem
                            key={v.id}
                            version={v}
                            isCurrent={isCurrent}
                            compareIndex={compareIndex}
                            canCompareMore={canCompareMore}
                            commitMessageNode={commitNode}
                            metaText={metaText}
                            onToggleCompare={() => toggleCompare(v.id)}
                            onSetBaseline={() => setBaselineTarget(v)}
                            onRollback={() => {
                              if (hasDraft) setRollbackTarget(v);
                              else onRequestRollback(v);
                            }}
                          />
                        );
                      })}

                      {cursor !== null ? (
                        <div className="pt-2">
                          <Button
                            variant="outline"
                            className="w-full"
                            disabled={loading}
                            onClick={() => void loadPage(cursor)}
                          >
                            {loading ? '加载中…' : '加载更多'}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {diffA && diffB ? (
        <PromptVersionDiffDialog
          open={diffOpen}
          versionA={diffA}
          versionB={diffB}
          onClose={() => {
            setDiffOpen(false);
            setDiffA(null);
            setDiffB(null);
          }}
        />
      ) : null}

      {baselineTarget ? (
        <ConfirmDialog
          open={!!baselineTarget}
          title="切换基线"
          description={
            hasDraft
              ? `切换到 v${baselineTarget.versionNo} 作为编辑基线？当前未保存的草稿将被丢弃。`
              : `切换到 v${baselineTarget.versionNo} 作为编辑基线？`
          }
          confirmText="确认切换"
          onClose={() => setBaselineTarget(null)}
          onConfirm={async () => {
            const v = baselineTarget;
            setBaselineTarget(null);
            await onSetBaseline(v);
            onClose();
          }}
        />
      ) : null}

      {rollbackTarget ? (
        <ConfirmDialog
          open={!!rollbackTarget}
          title="回滚确认"
          description={
            hasDraft
              ? `回滚将会以 v${rollbackTarget.versionNo} 的内容创建新版本。当前未保存的草稿不会被提交。是否继续？`
              : `回滚将会以 v${rollbackTarget.versionNo} 的内容创建新版本。是否继续？`
          }
          confirmText="继续"
          danger
          onClose={() => setRollbackTarget(null)}
          onConfirm={() => {
            const v = rollbackTarget;
            setRollbackTarget(null);
            onRequestRollback(v);
          }}
        />
      ) : null}
    </>
  );
}
