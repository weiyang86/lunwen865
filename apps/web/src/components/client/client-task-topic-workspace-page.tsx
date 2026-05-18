'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClientTaskListPage } from '@/components/client/client-task-list-page';
import { ClientOpeningReportWorkbench } from '@/components/client/client-opening-report-workbench';
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

export function ClientTaskTopicWorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams?.get('taskId') ?? null;
  const tab = searchParams?.get('tab') ?? null;

  const decodedTaskId = useMemo(() => resolveTaskIdFromQuery(taskId), [taskId]);
  const activeTab =
    tab === 'opening'
      ? 'opening'
      : tab === 'outline'
        ? 'outline'
        : tab === 'writing'
          ? 'writing'
          : 'topic';
  const [task, setTask] = useState<TaskBasic | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

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

  if (!decodedTaskId) {
    return <ClientTaskListPage />;
  }

  const setTab = (next: 'topic' | 'opening' | 'outline' | 'writing') => {
    router.replace(
      `/tasks?taskId=${encodeURIComponent(decodedTaskId)}&tab=${next}`,
    );
  };

  const stage = task?.currentStage ?? '';
  const needsTopicBeforeOpening =
    stage === 'INIT' || stage === 'TOPIC' || stage.startsWith('TOPIC_');
  const needsOutlineBeforeWriting =
    stage === 'OPENING' ||
    stage.startsWith('OPENING_') ||
    stage === 'OUTLINE' ||
    stage.startsWith('OUTLINE_');

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">任务工作区</h1>
            <p className="text-sm text-slate-600">
              当前任务：{task?.title ?? '加载中...'}（{decodedTaskId}）
              {task?.currentStage ? `；阶段：${task.currentStage}` : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('topic')}
              className={`rounded px-3 py-2 text-sm ${
                activeTab === 'topic'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              题目生成
            </button>
            <button
              type="button"
              onClick={() => setTab('opening')}
              className={`rounded px-3 py-2 text-sm ${
                activeTab === 'opening'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              开题报告
            </button>
            <button
              type="button"
              onClick={() => setTab('outline')}
              className={`rounded px-3 py-2 text-sm ${
                activeTab === 'outline'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              目录/大纲
            </button>
            <button
              type="button"
              onClick={() => setTab('writing')}
              className={`rounded px-3 py-2 text-sm ${
                activeTab === 'writing'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              正文生成
            </button>
            <Link
              href="/tasks"
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              返回任务列表
            </Link>
          </div>
        </div>
      </div>

      {taskError ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {taskError}
        </div>
      ) : null}

      {activeTab === 'topic' ? (
        <ClientTopicWorkbench
          taskId={decodedTaskId}
          onTopicConfirmed={() => {
            void loadTask();
            setTab('opening');
          }}
        />
      ) : null}

      {activeTab === 'opening' ? (
        <div className="space-y-4">
          {needsTopicBeforeOpening ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              请先在“题目生成”里选定一个题目后，再进入开题报告生成。
            </div>
          ) : null}
          <ClientOpeningReportWorkbench
            taskId={decodedTaskId}
            taskTitle={task?.title ?? null}
            onConfirmed={() => setTab('outline')}
          />
        </div>
      ) : null}

      {activeTab === 'outline' ? (
        <div className="space-y-4">
          {needsTopicBeforeOpening ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              请先在“题目生成”里选定一个题目后，再进入目录/大纲生成。
            </div>
          ) : null}
          <ClientOutlineWorkbench
            taskId={decodedTaskId}
            taskTitle={task?.title ?? null}
            wordCountTarget={task?.totalWordCount ?? null}
            onWordCountTargetSaved={() => void loadTask()}
            onLocked={() => {
              void loadTask();
              setTab('writing');
            }}
          />
        </div>
      ) : null} 

      {activeTab === 'writing' ? (
        <div className="space-y-4">
          {needsOutlineBeforeWriting ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              建议先完成开题报告与目录/大纲后，再进入正文生成流程。
            </div>
          ) : null}
          <ClientWritingWorkbench taskId={decodedTaskId} />
        </div>
      ) : null}
    </div>
  );
}
