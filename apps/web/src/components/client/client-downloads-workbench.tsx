'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';

type ExportItem = {
  id: string;
  taskId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  progress: number;
  fileName?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ExportListResponse = {
  items: ExportItem[];
};

export function ClientDownloadsWorkbench() {
  const [taskId, setTaskId] = useState('');
  const [formatTemplate, setFormatTemplate] = useState('GENERIC');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [items, setItems] = useState<ExportItem[]>([]);

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

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const emptyMessage = useMemo(() => (!items.length ? '暂无交付文件，请先发起导出。' : null), [items.length]);

  const handleCreateExport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!taskId.trim()) {
      setError('请填写 taskId 后再发起导出。');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      await clientHttp.post('/export', {
        taskId: taskId.trim(),
        template: formatTemplate,
      });
      setSuccess('导出任务已创建，可在列表中查看进度并下载。');
      setTaskId('');
      await loadItems();
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
        <label className="text-sm">任务 ID
          <input value={taskId} onChange={(e) => setTaskId(e.target.value)} placeholder="填写 taskId" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting} />
        </label>
        <label className="text-sm">导出模板
          <select value={formatTemplate} onChange={(e) => setFormatTemplate(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting}>
            <option value="GENERIC">通用格式</option>
            <option value="UNDERGRADUATE">本科论文</option>
            <option value="MASTER">硕士论文</option>
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
                  <p className="text-sm font-medium">导出任务：{item.id}</p>
                  <p className="text-xs text-slate-500">taskId：{item.taskId} ｜ 状态：{item.status} ｜ 进度：{item.progress}%</p>
                </div>
                <div className="flex gap-2">
                  {item.status === 'SUCCESS' ? (
                    <a href={`${(process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '')}/api/export/${item.id}/download`} className="rounded bg-slate-900 px-3 py-2 text-xs text-white">下载文件</a>
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
