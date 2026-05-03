'use client';

import { Fragment, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PromptVariable, PromptVersion } from '@/types/prompt';
import { computeVersionDiffSummary } from '../utils/versionDiffSummary';
import { alignDiffOps, diffLines } from './utils/diffLines';

interface Props {
  open: boolean;
  versionA: PromptVersion;
  versionB: PromptVersion;
  onClose: () => void;
}

type TabKey = 'summary' | 'content' | 'variables' | 'model' | 'metadata';

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-2 text-sm -mb-px border-b-2 focus:outline-none whitespace-nowrap',
        active
          ? 'font-medium text-primary border-primary'
          : 'text-slate-500 hover:text-slate-700 border-transparent',
      )}
    >
      {children}
    </button>
  );
}

function variableFingerprint(v: PromptVariable) {
  return JSON.stringify({
    type: v.type,
    required: v.required,
    defaultValue: v.defaultValue ?? '',
    description: v.description ?? '',
    options: v.options ?? null,
  });
}

export function PromptVersionDiffDialog({ open, versionA, versionB, onClose }: Props) {
  const [tab, setTab] = useState<TabKey>('summary');

  const [older, newer] = useMemo(() => {
    return versionA.versionNo <= versionB.versionNo ? [versionA, versionB] : [versionB, versionA];
  }, [versionA, versionB]);

  const summary = useMemo(() => {
    return computeVersionDiffSummary(newer, older);
  }, [newer, older]);

  const tooLarge =
    older.content.split('\n').length > 5000 || newer.content.split('\n').length > 5000;

  const aligned = useMemo(() => {
    const ops = diffLines(older.content, newer.content);
    return alignDiffOps(ops);
  }, [newer.content, older.content]);

  const allVarNames = useMemo(() => {
    const set = new Set<string>();
    for (const v of older.variables) set.add(v.name);
    for (const v of newer.variables) set.add(v.name);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [newer.variables, older.variables]);

  const olderVarMap = useMemo(() => new Map(older.variables.map((v) => [v.name, v])), [older.variables]);
  const newerVarMap = useMemo(() => new Map(newer.variables.map((v) => [v.name, v])), [newer.variables]);

  const modelRows = useMemo(() => {
    const keys: Array<{ k: keyof typeof older.modelConfig; label: string }> = [
      { k: 'provider', label: 'Provider' },
      { k: 'model', label: 'Model' },
      { k: 'temperature', label: 'Temperature' },
      { k: 'maxTokens', label: 'Max Tokens' },
      { k: 'topP', label: 'Top P' },
      { k: 'frequencyPenalty', label: 'Frequency Penalty' },
      { k: 'presencePenalty', label: 'Presence Penalty' },
    ];
    return keys.map(({ k, label }) => {
      const a = (older.modelConfig as any)[k];
      const b = (newer.modelConfig as any)[k];
      return {
        key: String(k),
        label,
        a: a === undefined ? '—' : String(a),
        b: b === undefined ? '—' : String(b),
        diff: a !== b,
      };
    });
  }, [newer, older]);

  const tagDiff = useMemo(() => {
    const a = new Set(older.metadata.tags);
    const b = new Set(newer.metadata.tags);
    const onlyA = older.metadata.tags.filter((t) => !b.has(t));
    const onlyB = newer.metadata.tags.filter((t) => !a.has(t));
    return { onlyA, onlyB, a, b };
  }, [newer, older]);

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
              <Dialog.Panel className="w-full max-w-4xl rounded-lg border border-slate-200 bg-white shadow-xl">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
                  <div>
                    <Dialog.Title className="text-base font-semibold text-slate-900">
                      对比 v{older.versionNo} ↔ v{newer.versionNo}
                    </Dialog.Title>
                    <div className="mt-1 text-sm text-slate-500">
                      仅行级 diff，不做字符级对比
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    aria-label="关闭"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex border-b border-slate-200 px-4">
                  <TabButton active={tab === 'summary'} onClick={() => setTab('summary')}>
                    摘要
                  </TabButton>
                  <TabButton active={tab === 'content'} onClick={() => setTab('content')}>
                    内容
                  </TabButton>
                  <TabButton active={tab === 'variables'} onClick={() => setTab('variables')}>
                    变量
                  </TabButton>
                  <TabButton active={tab === 'model'} onClick={() => setTab('model')}>
                    模型
                  </TabButton>
                  <TabButton active={tab === 'metadata'} onClick={() => setTab('metadata')}>
                    元信息
                  </TabButton>
                </div>

                <div className="max-h-screen overflow-auto p-4">
                  {tab === 'summary' ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                      {summary.length === 0 ? (
                        <div className="text-slate-500">两个版本完全相同</div>
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
                  ) : null}

                  {tab === 'content' ? (
                    <div className="space-y-3">
                      <div className="text-xs text-slate-500">红=删除 · 绿=新增 · 灰=占位</div>
                      {tooLarge ? (
                        <div className="text-xs text-slate-500">
                          内容过长，已降级为整体替换
                        </div>
                      ) : null}
                      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                        <div className="rounded-md border border-slate-200">
                          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                            v{older.versionNo}
                          </div>
                          <div className="max-h-96 overflow-auto">
                            {aligned.left.map((r, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  'flex px-3 py-1',
                                  r.type === 'del' ? 'bg-rose-50' : '',
                                  r.type === 'placeholder' ? 'bg-slate-50' : '',
                                )}
                              >
                                <div className="w-10 select-none pr-2 text-right text-slate-400 tabular-nums">
                                  {r.no ?? ''}
                                </div>
                                <div className="flex-1 whitespace-pre-wrap break-words text-slate-800">
                                  {r.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-md border border-slate-200">
                          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                            v{newer.versionNo}
                          </div>
                          <div className="max-h-96 overflow-auto">
                            {aligned.right.map((r, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  'flex px-3 py-1',
                                  r.type === 'add' ? 'bg-emerald-50' : '',
                                  r.type === 'placeholder' ? 'bg-slate-50' : '',
                                )}
                              >
                                <div className="w-10 select-none pr-2 text-right text-slate-400 tabular-nums">
                                  {r.no ?? ''}
                                </div>
                                <div className="flex-1 whitespace-pre-wrap break-words text-slate-800">
                                  {r.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {tab === 'variables' ? (
                    <div className="max-h-96 overflow-auto rounded-md border border-slate-200">
                      <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <div className="col-span-3 font-medium">名称</div>
                        <div className="col-span-4 font-medium">v{older.versionNo}</div>
                        <div className="col-span-5 font-medium">v{newer.versionNo}</div>
                      </div>
                      <div className="divide-y divide-slate-200">
                        {allVarNames.map((name) => {
                          const a = olderVarMap.get(name);
                          const b = newerVarMap.get(name);
                          const onlyA = !!a && !b;
                          const onlyB = !!b && !a;
                          const changed = a && b ? variableFingerprint(a) !== variableFingerprint(b) : false;

                          const border =
                            onlyA ? 'border-l-4 border-rose-400' : onlyB ? 'border-l-4 border-emerald-400' : changed ? 'border-l-4 border-amber-400' : '';

                          function cell(v: PromptVariable | undefined) {
                            if (!v) return <div className="text-sm text-slate-400">—</div>;
                            return (
                              <div className="space-y-1 text-sm text-slate-700">
                                <div>type: {v.type}</div>
                                <div>required: {v.required ? 'true' : 'false'}</div>
                                <div>default: {v.defaultValue ?? '—'}</div>
                                <div>desc: {v.description ?? '—'}</div>
                              </div>
                            );
                          }

                          return (
                            <div key={name} className={cn('grid grid-cols-12 gap-3 px-3 py-3', border)}>
                              <div className={cn('col-span-3 font-mono text-sm text-slate-900', onlyA ? 'line-through text-slate-500' : '')}>
                                {name}
                              </div>
                              <div className="col-span-4">{cell(a)}</div>
                              <div className="col-span-5">{cell(b)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {tab === 'model' ? (
                    <div className="overflow-auto rounded-md border border-slate-200 text-sm">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600">
                            <th className="border-b border-slate-200 px-3 py-2 text-left font-medium">字段</th>
                            <th className="border-b border-slate-200 px-3 py-2 text-left font-medium">
                              v{older.versionNo}
                            </th>
                            <th className="border-b border-slate-200 px-3 py-2 text-left font-medium">
                              v{newer.versionNo}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {modelRows.map((r) => (
                            <tr key={r.key} className={cn(r.diff ? 'bg-amber-50' : '')}>
                              <td className="border-b border-slate-200 px-3 py-2 text-slate-700">{r.label}</td>
                              <td className="border-b border-slate-200 px-3 py-2 font-mono text-slate-800">{r.a}</td>
                              <td className="border-b border-slate-200 px-3 py-2 font-mono text-slate-800">{r.b}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {tab === 'metadata' ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className={cn('rounded-md border border-slate-200 p-3', older.metadata.title !== newer.metadata.title ? 'bg-amber-50' : '')}>
                          <div className="text-xs text-slate-500">标题（v{older.versionNo}）</div>
                          <div className="mt-1 text-sm text-slate-900">{older.metadata.title || '—'}</div>
                        </div>
                        <div className={cn('rounded-md border border-slate-200 p-3', older.metadata.title !== newer.metadata.title ? 'bg-amber-50' : '')}>
                          <div className="text-xs text-slate-500">标题（v{newer.versionNo}）</div>
                          <div className="mt-1 text-sm text-slate-900">{newer.metadata.title || '—'}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className={cn('rounded-md border border-slate-200 p-3', older.metadata.description !== newer.metadata.description ? 'bg-amber-50' : '')}>
                          <div className="text-xs text-slate-500">描述（v{older.versionNo}）</div>
                          <div className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                            {older.metadata.description || '—'}
                          </div>
                        </div>
                        <div className={cn('rounded-md border border-slate-200 p-3', older.metadata.description !== newer.metadata.description ? 'bg-amber-50' : '')}>
                          <div className="text-xs text-slate-500">描述（v{newer.versionNo}）</div>
                          <div className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                            {newer.metadata.description || '—'}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-md border border-slate-200 p-3">
                        <div className="text-xs text-slate-500">标签</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Array.from(new Set([...older.metadata.tags, ...newer.metadata.tags])).map((t) => {
                            const inA = tagDiff.a.has(t);
                            const inB = tagDiff.b.has(t);
                            return (
                              <span
                                key={t}
                                className={cn(
                                  'rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700',
                                  inA && !inB ? 'line-through opacity-60' : '',
                                  inB && !inA ? 'ring-2 ring-emerald-400' : '',
                                )}
                              >
                                {t}
                              </span>
                            );
                          })}
                          {older.metadata.tags.length === 0 && newer.metadata.tags.length === 0 ? (
                            <span className="text-sm text-slate-400">—</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className={cn('rounded-md border border-slate-200 p-3', older.changelog !== newer.changelog ? 'bg-amber-50' : '')}>
                          <div className="text-xs text-slate-500">Commit Message（v{older.versionNo}）</div>
                          <div className="mt-1 text-sm text-slate-900">{older.changelog || '—'}</div>
                        </div>
                        <div className={cn('rounded-md border border-slate-200 p-3', older.changelog !== newer.changelog ? 'bg-amber-50' : '')}>
                          <div className="text-xs text-slate-500">Commit Message（v{newer.versionNo}）</div>
                          <div className="mt-1 text-sm text-slate-900">{newer.changelog || '—'}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-md border border-slate-200 p-3">
                          <div className="text-xs text-slate-500">作者 / 时间（v{older.versionNo}）</div>
                          <div className="mt-1 text-sm text-slate-900">
                            {older.createdBy?.name ?? '—'} · {older.createdAt}
                          </div>
                        </div>
                        <div className="rounded-md border border-slate-200 p-3">
                          <div className="text-xs text-slate-500">作者 / 时间（v{newer.versionNo}）</div>
                          <div className="mt-1 text-sm text-slate-900">
                            {newer.createdBy?.name ?? '—'} · {newer.createdAt}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end border-t border-slate-200 p-4">
                  <Button variant="ghost" onClick={onClose}>
                    关闭
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
