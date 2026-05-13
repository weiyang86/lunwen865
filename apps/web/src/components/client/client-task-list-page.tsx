'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';

type TaskItem = {
  id: string;
  title: string | null;
  major: string;
  educationLevel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type TaskListResponse = {
  items: TaskItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
};

export function ClientTaskListPage() {
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TaskListResponse | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await clientHttp.get<TaskListResponse>('/tasks/me', {
        page,
        pageSize: 10,
      });
      setData(result);
    } catch {
      setError('加载任务列表失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const totalPages = data?.totalPages ?? Math.max(1, Math.ceil((data?.total || 0) / (data?.pageSize || 10)));

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">我的任务列表</h1>
          <p className="text-sm text-slate-600">查看你创建的论文任务，并进入题目生成功能。</p>
        </div>
        <button
          type="button"
          onClick={() => void loadTasks()}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          disabled={loading}
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </header>

      {loading ? <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">加载中...</div> : null}
      {error ? <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div> : null}

      {!loading && !error && (data?.items?.length || 0) === 0 ? (
        <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">暂无任务，先去创建任务后再进入题目生成。</div>
      ) : null}

      {!loading && !error && (data?.items?.length || 0) > 0 ? (
        <ul className="space-y-3">
          {data?.items.map((task) => (
            <li key={task.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{task.title || `任务 ${task.id.slice(0, 8)}`}</h2>
                  <p className="mt-1 text-xs text-slate-500">{task.major} / {task.educationLevel}</p>
                  <p className="text-xs text-slate-500">状态：{task.status}</p>
                </div>
                <Link href={`/tasks?taskId=${encodeURIComponent(task.id)}`} className="rounded bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800">
                  进入题目生成
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && !error && totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50">上一页</button>
          <span>第 {page} / {totalPages} 页</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50">下一页</button>
        </div>
      ) : null}
    </section>
  );
}
