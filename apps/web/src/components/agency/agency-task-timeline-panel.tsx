'use client';

import { useEffect, useMemo, useState } from 'react';
import { AgencyPageState, type AgencyPageViewState } from './agency-page-state';

type TimelineItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  status?: string | null;
  stage?: string | null;
};

type TimelineResponse = {
  taskId: string;
  currentStatus: string;
  currentStage: string | null;
  items: TimelineItem[];
};

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '') +
  '/api';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function AgencyTaskTimelinePanel({ taskId }: { taskId?: string }) {
  const [state, setState] = useState<AgencyPageViewState>(taskId ? 'loading' : 'empty');
  const [errorMessage, setErrorMessage] = useState('机构任务时间线加载失败');
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!taskId) {
        setTimeline(null);
        setState('empty');
        return;
      }

      setState('loading');
      setErrorMessage('机构任务时间线加载失败');

      try {
        const res = await fetch(`${API_BASE}/agency/tasks/${taskId}/timeline`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as TimelineResponse;
        if (cancelled) return;

        if (!data.items || data.items.length === 0) {
          setTimeline(data);
          setState('empty');
          return;
        }

        setTimeline(data);
        setState('success');
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : '未知错误';
        setErrorMessage(`机构任务时间线加载失败：${message}`);
        setState('error');
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const items = useMemo(() => timeline?.items ?? [], [timeline]);

  return (
    <AgencyPageState
      title="进度追踪"
      state={state}
      emptyMessage={taskId ? '当前任务暂无可展示时间线。' : '请先提供 taskId（例如 /agency/progress?taskId=xxx）'}
      errorMessage={errorMessage}
    >
      <section className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">机构任务时间线</h1>
          <p className="text-sm text-slate-600">
            任务 ID：{timeline?.taskId ?? taskId}；当前状态：{timeline?.currentStatus ?? '未知'}；当前阶段：
            {timeline?.currentStage ?? '未知'}
          </p>
        </header>

        <ol className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border bg-white p-4">
              <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                类型：{item.type} ｜ 状态：{item.status ?? '-'} ｜ 阶段：{item.stage ?? '-'}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </AgencyPageState>
  );
}
