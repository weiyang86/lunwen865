'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';

type TopicCandidate = {
  id: string;
  title: string;
  isSelected: boolean;
  generationBatch: number;
  rationale?: string;
  keywords?: string[];
  estimatedDifficulty?: string;
  createdAt: string;
};

type GeneratePayload = {
  count: number;
  additionalContext?: string;
  preferredStyle?: string;
};

export function ClientTopicWorkbench({ taskId }: { taskId?: string }) {
  const [count, setCount] = useState(5);
  const [additionalContext, setAdditionalContext] = useState('');
  const [preferredStyle, setPreferredStyle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TopicCandidate[]>([]);

  const emptyReason = useMemo(() => {
    if (!taskId) return '请先提供 taskId（例如：/tasks?taskId=xxx）';
    if (!items.length) return '当前任务还没有题目候选，先提交一次生成。';
    return null;
  }, [items.length, taskId]);

  const loadCandidates = useCallback(async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await clientHttp.get<TopicCandidate[]>(`/tasks/${taskId}/topics/latest`);
      setItems(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '加载题目候选失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || !taskId) return;
    if (count < 1 || count > 10) {
      setError('候选数量必须在 1 到 10 之间');
      return;
    }

    const payload: GeneratePayload = { count };
    if (additionalContext.trim()) payload.additionalContext = additionalContext.trim();
    if (preferredStyle.trim()) payload.preferredStyle = preferredStyle.trim();

    try {
      setSubmitting(true);
      setError(null);
      await clientHttp.post(`/tasks/${taskId}/topics/generate`, payload);
      await loadCandidates();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '生成失败，请检查任务状态或稍后重试。'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">论文题目生成</h1>
        <p className="text-sm text-slate-600">提交生成请求并查看最新一批题目候选。</p>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <label className="text-sm">候选数量（1~10）
          <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting || !taskId} />
        </label>
        <label className="text-sm">偏好风格
          <input value={preferredStyle} onChange={(e) => setPreferredStyle(e.target.value)} placeholder="如：实证研究、案例分析" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting || !taskId} />
        </label>
        <label className="text-sm md:col-span-2">补充要求
          <textarea value={additionalContext} onChange={(e) => setAdditionalContext(e.target.value)} rows={3} placeholder="如：聚焦近三年中文文献、避免过宽选题" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting || !taskId} />
        </label>
        {error ? <p className="md:col-span-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        <div className="md:col-span-2">
          <button type="submit" disabled={submitting || !taskId} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{submitting ? '生成中...' : '生成题目'}</button>
        </div>
      </form>

      {loading ? <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">正在加载候选题目...</div> : null}
      {!loading && emptyReason ? <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">{emptyReason}</div> : null}

      {!loading && items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">{item.title}</h2>
                <span className="text-xs text-slate-500">第 {item.generationBatch} 轮</span>
              </div>
              {item.rationale ? <p className="mt-2 text-sm text-slate-600">理由：{item.rationale}</p> : null}
              {item.keywords?.length ? <p className="mt-1 text-xs text-slate-500">关键词：{item.keywords.join(' / ')}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
