'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClientTaskListPage } from '@/components/client/client-task-list-page';
import { ClientOpeningReportWorkbench } from '@/components/client/client-opening-report-workbench';
import { ClientAbstractWorkbench } from '@/components/client/client-abstract-workbench';
import { ClientOutlineWorkbench } from '@/components/client/client-outline-workbench';
import { ClientTopicWorkbench } from '@/components/client/client-topic-workbench';
import { ClientWritingWorkbench } from '@/components/client/client-writing-workbench';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';

export function resolveTaskIdFromQuery(raw: string | null): string {
  const value = raw?.trim();
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type TaskBasic = {
  id: string;
  title: string;
  currentStage: string | null;
  status: string;
  totalWordCount?: number | null;
};

type WorkspaceTab = 'topic' | 'opening' | 'outline' | 'abstract' | 'writing';

const WORKSPACE_TABS: Array<{ key: WorkspaceTab; label: string; hint: string }> = [
  { key: 'topic', label: '选题', hint: '生成候选题目并选定一个题目' },
  { key: 'opening', label: '开题报告', hint: '生成开题报告并检查内容' },
  { key: 'outline', label: '目录/大纲', hint: '生成大纲并锁定目录结构' },
  { key: 'abstract', label: '摘要', hint: '生成中英文摘要并确认' },
  { key: 'writing', label: '正文', hint: '按章节生成正文内容' },
];

function normalizeStageKey(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toUpperCase();
}

function resolveStageLabel(rawStage: string | null): string | null {
  const stage = normalizeStageKey(rawStage);
  if (!stage) return null;
  if (stage === 'INIT') return '初始化';
  if (stage.startsWith('TOPIC')) return '选题';
  if (stage.startsWith('OPENING')) return '开题报告';
  if (stage.startsWith('OUTLINE')) return '目录/大纲';
  if (stage.startsWith('ABSTRACT')) return '摘要';
  if (stage.startsWith('WRITING')) return '正文';
  if (stage.startsWith('MERGING')) return '合稿';
  if (stage.startsWith('FORMATTING')) return '排版/润色';
  if (stage.startsWith('REVIEW')) return '审核';
  if (stage.startsWith('REVISION')) return '修改';
  return rawStage;
}

function resolveGenerationOrder(input: { status: string | null | undefined; currentStage: string | null | undefined }): number {
  const stage = normalizeStageKey(input.currentStage);
  const status = normalizeStageKey(input.status);

  if (status === 'DONE') return 8;

  if (status === 'ABSTRACT_APPROVED') return 5;
  if (status === 'OUTLINE_APPROVED') return 4;
  if (status === 'OPENING_APPROVED') return 3;
  if (status === 'TOPIC_APPROVED') return 2;

  if (stage === 'FORMATTING' || stage === 'REVIEW' || stage === 'REVISION') return 7;
  if (status === 'FORMATTING' || status === 'REVIEW' || status === 'REVISION') return 7;

  if (stage === 'MERGING' || status === 'MERGING') return 6;

  if (stage === 'WRITING' || status === 'WRITING' || status === 'WRITING_PAUSED') return 5;

  if (stage === 'ABSTRACT' || status.startsWith('ABSTRACT_')) return 4;

  if (stage === 'OUTLINE' || status.startsWith('OUTLINE_')) return 3;

  if (stage === 'OPENING' || status.startsWith('OPENING_')) return 2;

  if (stage === 'TOPIC' || status.startsWith('TOPIC_')) return 1;

  return 0;
}

export function ClientTaskTopicWorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams?.get('taskId') ?? null;
  const tab = searchParams?.get('tab') ?? null;

  const decodedTaskId = useMemo(() => resolveTaskIdFromQuery(taskId), [taskId]);
  const requestedTab: WorkspaceTab =
    tab === 'opening'
      ? 'opening'
      : tab === 'outline'
        ? 'outline'
        : tab === 'abstract'
          ? 'abstract'
        : tab === 'writing'
          ? 'writing'
          : 'topic';
  const [task, setTask] = useState<TaskBasic | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [topicSelected, setTopicSelected] = useState<boolean | null>(null);
  const [openingReady, setOpeningReady] = useState<boolean | null>(null);
  const [outlineLocked, setOutlineLocked] = useState<boolean | null>(null);
  const [abstractConfirmed, setAbstractConfirmed] = useState<boolean | null>(null);
  const [outlineReloadSignal, setOutlineReloadSignal] = useState(0);
  const [outlineLockPromptOpen, setOutlineLockPromptOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1600);
  }, []);

  const loadTask = useCallback(async () => {
    if (!decodedTaskId) return;
    try {
      setTaskError(null);
      const data = await clientHttp.get<TaskBasic>(`/tasks/${decodedTaskId}`);
      setTask(data);
    } catch (e: unknown) {
      setTaskError(getApiErrorMessage(e, '加载任务信息失败，请稍后重试。'));
    }
  }, [decodedTaskId]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  useEffect(() => {
    setTopicSelected(null);
    setOpeningReady(null);
    setOutlineLocked(null);
    setAbstractConfirmed(null);
  }, [decodedTaskId]);

  const generationOrder = resolveGenerationOrder({
    status: task?.status,
    currentStage: task?.currentStage,
  });

  const stageLabel = resolveStageLabel(task?.currentStage ?? null);
  const abstractApproved =
    normalizeStageKey(task?.status) === 'ABSTRACT_APPROVED' || generationOrder >= 5;

  const completion = useMemo(() => {
    const topicDone = topicSelected ?? generationOrder >= 2;
    const openingDone = openingReady ?? generationOrder >= 3;
    const outlineDone = outlineLocked ?? generationOrder >= 4;
    const abstractDone = abstractConfirmed ?? abstractApproved;
    return { topicDone, openingDone, outlineDone, abstractDone };
  }, [abstractApproved, abstractConfirmed, generationOrder, openingReady, outlineLocked, topicSelected]);

  const maxUnlockedIndex = useMemo(() => {
    if (!completion.topicDone) return 0;
    if (!completion.openingDone) return 1;
    if (!completion.outlineDone) return 2;
    if (!completion.abstractDone) return 3;
    return 4;
  }, [completion.abstractDone, completion.openingDone, completion.outlineDone, completion.topicDone]);

  const canAccessTab = useCallback(
    (target: WorkspaceTab) => {
      const idx = WORKSPACE_TABS.findIndex((t) => t.key === target);
      return idx >= 0 && idx <= maxUnlockedIndex;
    },
    [maxUnlockedIndex],
  );

  const blockingReasonForTab = useCallback(
    (target: WorkspaceTab) => {
      const idx = WORKSPACE_TABS.findIndex((t) => t.key === target);
      if (idx <= 0) return null;
      if (idx === 1 && !completion.topicDone) return '请先在「选题」阶段选定一个题目，才能进入开题报告。';
      if (idx === 2 && !completion.openingDone) return '请先完成「开题报告」阶段，才能进入目录/大纲。';
      if (idx === 3 && !completion.outlineDone) return '请先锁定目录/大纲，才能进入摘要阶段。';
      if (idx === 4 && !completion.abstractDone) return '请先确认摘要（中英文），才能进入正文生成阶段。';
      return null;
    },
    [completion.abstractDone, completion.openingDone, completion.outlineDone, completion.topicDone],
  );

  const activeTab = useMemo(() => {
    if (canAccessTab(requestedTab)) return requestedTab;
    const requestedIndex = WORKSPACE_TABS.findIndex((t) => t.key === requestedTab);
    if (requestedIndex <= 0) return 'topic';
    for (let i = Math.min(requestedIndex, maxUnlockedIndex); i >= 0; i -= 1) {
      const key = WORKSPACE_TABS[i]?.key;
      if (key && canAccessTab(key)) return key;
    }
    return 'topic';
  }, [canAccessTab, maxUnlockedIndex, requestedTab]);

  useEffect(() => {
    if (!decodedTaskId) return;
    if (activeTab === requestedTab) return;
    const reason = blockingReasonForTab(requestedTab);
    if (reason) showToast(reason);
    router.replace(`/tasks?taskId=${encodeURIComponent(decodedTaskId)}&tab=${activeTab}`);
  }, [activeTab, blockingReasonForTab, decodedTaskId, requestedTab, router, showToast]);

  const setTab = useCallback(
    (next: WorkspaceTab) => {
      if (!decodedTaskId) return;
      if (!canAccessTab(next)) {
        const reason = blockingReasonForTab(next);
        showToast(reason || '当前阶段未完成，暂时无法进入该节点。');
        return;
      }
      router.replace(`/tasks?taskId=${encodeURIComponent(decodedTaskId)}&tab=${next}`);
    },
    [blockingReasonForTab, canAccessTab, decodedTaskId, router, showToast],
  );

  const nextTab = useMemo((): WorkspaceTab | null => {
    const idx = WORKSPACE_TABS.findIndex((t) => t.key === activeTab);
    if (idx < 0 || idx >= WORKSPACE_TABS.length - 1) return null;
    return WORKSPACE_TABS[idx + 1]!.key;
  }, [activeTab]);

  const stageTip = useMemo(() => {
    if (activeTab === 'topic') return '按流程推进：先生成候选题目并选定一个题目，完成后可进入开题报告。';
    if (activeTab === 'opening') return '本阶段建议生成开题报告并检查内容，完成后可进入目录/大纲。';
    if (activeTab === 'outline') return '本阶段建议生成大纲并锁定目录结构；未锁定前无法进入摘要阶段。';
    if (activeTab === 'abstract') return '本阶段需要生成并确认中英文摘要；确认后才能进入正文生成。';
    return '正文阶段支持随时回到已完成节点查看与调整。';
  }, [activeTab]);

  const confirmLabel = useMemo(() => {
    if (activeTab === 'topic') return '确认已选题';
    if (activeTab === 'opening') return '确认开题报告';
    if (activeTab === 'outline') return '锁定目录';
    if (activeTab === 'abstract') return '确认摘要（完成本阶段）';
    return '确认正文阶段';
  }, [activeTab]);

  const confirmingDisabled = useMemo(() => {
    if (activeTab === 'topic') return false;
    if (activeTab === 'opening') return false;
    if (activeTab === 'outline') return completion.outlineDone;
    if (activeTab === 'abstract') return completion.abstractDone;
    return true;
  }, [activeTab, completion.abstractDone, completion.outlineDone]);

  const handleConfirmStage = useCallback(async () => {
    if (!decodedTaskId) return;

    if (activeTab === 'topic') {
      if (!completion.topicDone) {
        showToast('请先在下方选择一个题目并点击“选定题目”。');
        return;
      }
      showToast('已确认选题完成。');
      await loadTask();
      return;
    }

    if (activeTab === 'opening') {
      if (!completion.openingDone) {
        showToast('请先生成开题报告，并确保报告内容已生成完成。');
        return;
      }
      showToast('已确认开题报告完成。');
      await loadTask();
      return;
    }

    if (activeTab === 'outline') {
      if (completion.outlineDone) {
        showToast('目录已锁定，可直接进入下一阶段。');
        return;
      }
      try {
        await clientHttp.post(`/tasks/${encodeURIComponent(decodedTaskId)}/outline/lock`);
        setOutlineLocked(true);
        setOutlineReloadSignal((v) => v + 1);
        showToast('已锁定目录。');
        await loadTask();
        setTab('abstract');
      } catch (e: unknown) {
        showToast(getApiErrorMessage(e, '锁定目录失败，请稍后重试。'));
      }
      return;
    }

    if (activeTab === 'abstract') {
      if (completion.abstractDone) {
        showToast('摘要已确认，可直接进入下一阶段。');
        return;
      }
      try {
        await clientHttp.post(`/tasks/${encodeURIComponent(decodedTaskId)}/abstract/confirm`);
        setAbstractConfirmed(true);
        showToast('已确认摘要。');
        await loadTask();
        setTab('writing');
      } catch (e: unknown) {
        showToast(getApiErrorMessage(e, '确认摘要失败，请稍后重试。'));
      }
      return;
    }
  }, [
    activeTab,
    completion.abstractDone,
    completion.openingDone,
    completion.outlineDone,
    completion.topicDone,
    decodedTaskId,
    loadTask,
    setTab,
    showToast,
  ]);

  if (!decodedTaskId) {
    return <ClientTaskListPage />;
  }

  const handleGoNext = async () => {
    if (!nextTab) return;
    if (canAccessTab(nextTab)) {
      setTab(nextTab);
      return;
    }
    if (activeTab === 'outline' && nextTab === 'abstract' && !completion.outlineDone) {
      setOutlineLockPromptOpen(true);
      return;
    }
    const reason = blockingReasonForTab(nextTab);
    showToast(reason || '请先完成当前阶段后再进入下一阶段。');
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">论文工作台</h1>
            <p className="text-sm text-slate-600">
              当前任务：{task?.title ?? '加载中...'}（{decodedTaskId}）
              {stageLabel ? `；阶段：${stageLabel}` : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadTask()}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              刷新任务
            </button>
            <Link href="/tasks" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              返回任务列表
            </Link>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-700">流程节点（可切换已解锁节点，未完成上一阶段无法进入下一阶段）</div>
            <div className="text-xs text-slate-500">已解锁：{maxUnlockedIndex + 1}/{WORKSPACE_TABS.length}</div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            {WORKSPACE_TABS.map((step, idx) => {
              const unlocked = idx <= maxUnlockedIndex;
              const done =
                (step.key === 'topic' && completion.topicDone) ||
                (step.key === 'opening' && completion.openingDone) ||
                (step.key === 'outline' && completion.outlineDone) ||
                (step.key === 'abstract' && completion.abstractDone) ||
                (step.key === 'writing' && generationOrder >= 5);
              const active = activeTab === step.key;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setTab(step.key)}
                  className={`flex items-start gap-2 rounded-lg border p-2 text-left transition ${
                    active
                      ? 'border-slate-900 bg-white'
                      : unlocked
                        ? 'border-slate-200 bg-white hover:border-slate-300'
                        : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                  }`}
                  aria-current={active ? 'step' : undefined}
                >
                  <div
                    className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      done
                        ? 'bg-emerald-600 text-white'
                        : active
                          ? 'bg-slate-900 text-white'
                          : unlocked
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-medium ${unlocked ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</div>
                    <div className={`mt-0.5 text-xs ${unlocked ? 'text-slate-600' : 'text-slate-400'}`}>{step.hint}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {taskError ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {taskError}
        </div>
      ) : null}

      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {stageTip}
      </div>

      {activeTab === 'topic' ? (
        <ClientTopicWorkbench
          taskId={decodedTaskId}
          onTopicConfirmed={() => {
            setTopicSelected(true);
            void loadTask();
            setTab('opening');
          }}
          onSelectionChange={(selected) => setTopicSelected(selected)}
        />
      ) : null}

      {activeTab === 'opening' ? (
        <div className="space-y-4">
          <ClientOpeningReportWorkbench
            taskId={decodedTaskId}
            taskTitle={task?.title ?? null}
            onConfirmed={() => {
              if (openingReady == null) setOpeningReady(true);
              setTab('outline');
            }}
            onReadyToProceedChange={(ready) => setOpeningReady(ready)}
          />
        </div>
      ) : null}

      {activeTab === 'outline' ? (
        <div className="space-y-4">
          <ClientOutlineWorkbench
            taskId={decodedTaskId}
            taskTitle={task?.title ?? null}
            wordCountTarget={task?.totalWordCount ?? null}
            onWordCountTargetSaved={() => void loadTask()}
            onLocked={() => {
              setOutlineLocked(true);
              setOutlineReloadSignal((v) => v + 1);
              void loadTask();
              setTab('abstract');
            }}
            onLockedChange={(locked) => setOutlineLocked(locked)}
            reloadSignal={outlineReloadSignal}
          />
        </div>
      ) : null} 

      {activeTab === 'abstract' ? (
        <div className="space-y-4">
          <ClientAbstractWorkbench
            taskId={decodedTaskId}
            onConfirmed={() => {
              setAbstractConfirmed(true);
              void loadTask();
              setTab('writing');
            }}
          />
        </div>
      ) : null}

      {activeTab === 'writing' ? (
        <div className="space-y-4">
          <ClientWritingWorkbench taskId={decodedTaskId} />
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900">
              当前节点：{WORKSPACE_TABS.find((x) => x.key === activeTab)?.label ?? activeTab}
            </div>
            <div className="text-xs text-slate-600">
              {nextTab ? `下一节点：${WORKSPACE_TABS.find((x) => x.key === nextTab)?.label ?? nextTab}` : '已到达最后一个节点'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleConfirmStage()}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
              disabled={confirmingDisabled}
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={() => void handleGoNext()}
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
              disabled={!nextTab}
            >
              进入下一阶段
            </button>
          </div>
        </div>
      </div>

      {outlineLockPromptOpen ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <div className="text-base font-medium text-slate-900">需要先锁定目录</div>
            <div className="mt-2 text-sm text-slate-600">
              当前目录/大纲尚未锁定，锁定后才能进入下一阶段。是否现在锁定目录？
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => setOutlineLockPromptOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
                onClick={() => {
                  setOutlineLockPromptOpen(false);
                  void handleConfirmStage();
                }}
              >
                锁定目录
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-20 -translate-x-1/2 rounded bg-slate-900 px-3 py-2 text-sm text-white">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
