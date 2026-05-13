'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClientTaskListPage } from '@/components/client/client-task-list-page';
import { ClientTopicWorkbench } from '@/components/client/client-topic-workbench';
import { ClientOpeningReportWorkbench } from '@/components/client/client-opening-report-workbench';
import { ClientWritingWorkbench } from '@/components/client/client-writing-workbench';
import { TaskTimelinePanel } from '@/components/client/task-timeline-panel';

export function resolveTaskIdFromQuery(taskId: string | null | undefined): string {
  if (!taskId) return '';
  return decodeURIComponent(taskId).trim();
}

export function ClientTaskTopicWorkspacePage() {
  const searchParams = useSearchParams();
  const taskId = searchParams?.get('taskId');

  const decodedTaskId = useMemo(() => resolveTaskIdFromQuery(taskId), [taskId]);

  if (!decodedTaskId) {
    return <ClientTaskListPage />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">题目生成工作区</h1>
            <p className="text-sm text-slate-600">当前任务 ID：{decodedTaskId}</p>
          </div>
          <Link href="/tasks" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
            返回任务列表
          </Link>
        </div>
      </div>

      <ClientTopicWorkbench taskId={decodedTaskId} />
      <ClientOpeningReportWorkbench taskId={decodedTaskId} />
      <TaskTimelinePanel taskId={decodedTaskId} />
      <ClientWritingWorkbench taskId={decodedTaskId} />
    </div>
  );
}
