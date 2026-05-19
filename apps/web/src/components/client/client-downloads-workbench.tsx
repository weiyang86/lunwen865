'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';

type TaskItem = {
  id: string;
  title: string | null;
  updatedAt: string;
};

type ExportItem = {
  id: string;
  title: string;
  paperId: string | null;
  polishTaskId: string | null;
  scope: 'OUTLINE_ONLY' | 'FULL_PAPER' | 'WITH_REVISIONS';
  template: 'GENERIC' | 'UNDERGRADUATE' | 'MASTER' | 'CUSTOM';
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  progress: number;
  fileName?: string | null;
  fileSize?: number | null;
  downloadCount?: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  errorMessage?: string | null;
};

type ExportListResponse = {
  items: ExportItem[];
};

type TaskListResponse = {
  items: TaskItem[];
};

export function ClientDownloadsWorkbench() {
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [formatTemplate, setFormatTemplate] = useState('UNDERGRADUATE');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [items, setItems] = useState<ExportItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const selectedTaskTitle = useMemo(() => {
    const found = tasks.find((t) => t.id === selectedTaskId);
    const title = (found?.title ?? '').trim();
    return title || null;
  }, [selectedTaskId, tasks]);

  const refreshInFlightRef = useRef(false);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientHttp.get<ExportListResponse>('/export', { page: 1, pageSize: 20 });
      setItems(data.items || []);
    } catch (err) {
      setError(getApiErrorMessage(err, '加载下载列表失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshItems = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    try {
      refreshInFlightRef.current = true;
      const data = await clientHttp.get<ExportListResponse>('/export', { page: 1, pageSize: 20 });
      setItems(data.items || []);
    } catch {
      // ignore transient refresh errors to avoid noisy UX
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      setTasksLoading(true);
      const data = await clientHttp.get<TaskListResponse>('/tasks', { page: 1, pageSize: 50 });
      const list = Array.isArray(data.items) ? data.items : [];
      setTasks(
        list
          .slice()
          .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
      );
    } catch {
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const emptyMessage = useMemo(() => (!items.length ? '暂无交付文件，请先发起导出。' : null), [items.length]);
  const taskTitleMap = useMemo(() => new Map(tasks.map((t) => [t.id, (t.title ?? '').trim()])), [tasks]);
  const hasActiveExport = useMemo(() => {
    const active = new Set(['PENDING', 'RUNNING', 'PROCESSING']);
    return items.some((it) => active.has(String(it.status)));
  }, [items]);

  useEffect(() => {
    if (!hasActiveExport) return;
    const timer = window.setInterval(() => {
      void refreshItems();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasActiveExport, refreshItems]);

  const handleCreateExport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!selectedTaskId.trim()) {
      setError('请选择任务后再发起导出。');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      await clientHttp.post('/export', {
        paperId: selectedTaskId.trim(),
        scope: 'FULL_PAPER',
        template: formatTemplate,
        title: selectedTaskTitle ?? `论文_${selectedTaskId.trim().slice(0, 8)}`,
      });
      setSuccess('导出任务已创建，可在列表中查看进度并下载。');
      setSelectedTaskId('');
      await loadItems();
      void refreshItems();
    } catch (err) {
      setError(getApiErrorMessage(err, '创建导出任务失败，请稍后重试。'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      setError(null);
      await clientHttp.post(`/export/${id}/retry`);
      await loadItems();
      void refreshItems();
    } catch (err) {
      setError(getApiErrorMessage(err, '重试导出失败，请稍后重试。'));
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <header>
        <h1 className="text-2xl font-semibold">下载与交付验收</h1>
        <p className="text-sm text-slate-600">创建导出任务，查看交付进度，并下载成功文件。</p>
      </header>

      <form onSubmit={handleCreateExport} className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">任务
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            disabled={submitting || tasksLoading}
          >
            <option value="">{tasksLoading ? '加载任务中...' : '请选择任务（按标题）'}</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {(t.title ?? '').trim() || `任务 ${t.id.slice(0, 8)}`}
              </option>
            ))}
          </select>
          {selectedTaskId ? (
            <p className="mt-1 text-xs text-slate-500">taskId：{selectedTaskId}</p>
          ) : null}
        </label>
        <label className="text-sm">导出模板
          <select value={formatTemplate} onChange={(e) => setFormatTemplate(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting}>
            <option value="UNDERGRADUATE">常用论文模板（推荐）</option>
            <option value="MASTER">硕士论文</option>
            <option value="GENERIC">通用格式（简版）</option>
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={submitting} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{submitting ? '创建中...' : '创建导出任务'}</button>
        </div>
      </form>

      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

      {loading ? <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">加载下载列表中...</div> : null}
      {!loading && emptyMessage ? <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">{emptyMessage}</div> : null}

      {!loading && items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">导出任务：{item.title || item.id}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    ID：{item.id}｜模板：{item.template}｜范围：{item.scope}｜状态：{item.status}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    论文任务：{(() => {
                      const pid = item.paperId ?? '';
                      const t = pid ? taskTitleMap.get(pid) : '';
                      return t ? t : pid ? `任务 ${pid.slice(0, 8)}` : '（无）';
                    })()}
                  </p>
                  <div className="mt-2 w-full max-w-lg space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>进度</span>
                      <span>{Math.min(100, Math.max(0, Math.round(item.progress ?? 0)))}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
                      <div
                        className={
                          item.status === 'FAILED'
                            ? 'h-2 rounded bg-red-500'
                            : item.status === 'SUCCESS'
                              ? 'h-2 rounded bg-emerald-600'
                              : 'h-2 rounded bg-sky-500'
                        }
                        style={{ width: `${Math.min(100, Math.max(0, item.progress ?? 0))}%` }}
                      />
                    </div>
                  </div>
                  {item.errorMessage ? (
                    <p className="mt-2 text-xs text-red-600">{item.errorMessage}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {item.status === 'SUCCESS' ? (
                    <a href={`/api/export/${item.id}/download`} className="rounded bg-slate-900 px-3 py-2 text-xs text-white">下载文件</a>
                  ) : null}
                  {item.status === 'FAILED' ? (
                    <button type="button" onClick={() => void handleRetry(item.id)} className="rounded border border-slate-300 px-3 py-2 text-xs">重试导出</button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
