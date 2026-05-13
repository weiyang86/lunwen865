'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';

type TopicCandidate = { id: string; title: string; generationBatch: number; rationale?: string; keywords?: string[] };
type BootstrapTask = { id: string; title: string; status: string };

export function ClientTopicWorkbench({ taskId }: { taskId?: string }) {
  const [activeTaskId, setActiveTaskId] = useState(taskId || '');
  const [bootstrapTitle, setBootstrapTitle] = useState('');
  const [bootstrapMajor, setBootstrapMajor] = useState('');
  const [bootstrapping, setBootstrapping] = useState(false);

  const [count, setCount] = useState(5);
  const [additionalContext, setAdditionalContext] = useState('');
  const [preferredStyle, setPreferredStyle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TopicCandidate[]>([]);

  useEffect(() => { setActiveTaskId(taskId || ''); }, [taskId]);

  const emptyReason = useMemo(() => {
    if (!activeTaskId) return '请先创建任务或输入 taskId。';
    if (!items.length) return '当前任务还没有题目候选，先提交一次生成。';
    return null;
  }, [activeTaskId, items.length]);

  const loadCandidates = useCallback(async () => {
    if (!activeTaskId) return;
    try {
      setLoading(true); setError(null);
      const data = await clientHttp.get<TopicCandidate[]>(`/tasks/${activeTaskId}/topics/latest`);
      setItems(data);
    } catch {
      setError('加载题目候选失败，请稍后重试');
    } finally { setLoading(false); }
  }, [activeTaskId]);

  useEffect(() => { void loadCandidates(); }, [loadCandidates]);

  const handleBootstrap = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (bootstrapping) return;
    try {
      setBootstrapping(true); setError(null);
      const task = await clientHttp.post<BootstrapTask>('/tasks/bootstrap', { title: bootstrapTitle, major: bootstrapMajor });
      setActiveTaskId(task.id);
      window.history.replaceState(null, '', `/tasks?taskId=${encodeURIComponent(task.id)}`);
    } catch {
      setError('创建任务失败，请稍后重试');
    } finally { setBootstrapping(false); }
  };

  const handleGenerate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || !activeTaskId) return;
    if (count < 1 || count > 10) return setError('候选数量必须在 1 到 10 之间');
    try {
      setSubmitting(true); setError(null);
      await clientHttp.post(`/tasks/${activeTaskId}/topics/generate`, { count, additionalContext: additionalContext || undefined, preferredStyle: preferredStyle || undefined });
      await loadCandidates();
    } catch { setError('生成失败，请检查任务状态或稍后重试'); }
    finally { setSubmitting(false); }
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">论文任务与题目生成</h1>
      <form onSubmit={handleBootstrap} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <input value={bootstrapTitle} onChange={(e) => setBootstrapTitle(e.target.value)} placeholder="任务标题（可选）" className="rounded border border-slate-300 px-3 py-2" />
        <input value={bootstrapMajor} onChange={(e) => setBootstrapMajor(e.target.value)} placeholder="专业（可选）" className="rounded border border-slate-300 px-3 py-2" />
        <div className="md:col-span-2 flex items-center gap-3">
          <button type="submit" disabled={bootstrapping} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{bootstrapping ? '创建中...' : '快速创建任务'}</button>
          <input value={activeTaskId} onChange={(e) => setActiveTaskId(e.target.value)} placeholder="或直接输入 taskId" className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2" />
        </div>
      </form>

      <form onSubmit={handleGenerate} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} className="rounded border border-slate-300 px-3 py-2" disabled={submitting || !activeTaskId} />
        <input value={preferredStyle} onChange={(e) => setPreferredStyle(e.target.value)} placeholder="偏好风格" className="rounded border border-slate-300 px-3 py-2" disabled={submitting || !activeTaskId} />
        <textarea value={additionalContext} onChange={(e) => setAdditionalContext(e.target.value)} rows={3} placeholder="补充要求" className="md:col-span-2 rounded border border-slate-300 px-3 py-2" disabled={submitting || !activeTaskId} />
        {error ? <p className="md:col-span-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        <button type="submit" disabled={submitting || !activeTaskId} className="w-fit rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{submitting ? '生成中...' : '生成题目'}</button>
      </form>

      {loading ? <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">正在加载候选题目...</div> : null}
      {!loading && emptyReason ? <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">{emptyReason}</div> : null}
      {!loading && items.length > 0 ? <ul className="space-y-3">{items.map((i) => <li key={i.id} className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-medium">{i.title}</h2><p className="text-xs text-slate-500">第 {i.generationBatch} 轮</p>{i.rationale ? <p className="mt-1 text-sm text-slate-600">{i.rationale}</p> : null}</li>)}</ul> : null}
    </section>
  );
}
