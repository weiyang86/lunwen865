'use client';

import { useState } from 'react';
import { clientAuth } from '@/lib/client/auth';
import { getApiErrorMessage } from '@/lib/client/api-error';

type WritingSession = { id: string; status: string; createdAt: string; updatedAt: string };
type WritingSection = { id: string; title: string; status: string; orderIndex: number; generatedContent?: string; editedContent?: string };
type WritingStageStatus = 'idle' | 'queued' | 'running' | 'success' | 'failed';

const API_BASE = `${(process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '')}/api`;

export function ClientWritingWorkbench({ taskId }: { taskId?: string }) {
  const [status, setStatus] = useState<WritingStageStatus>('idle');
  const [session, setSession] = useState<WritingSession | null>(null);
  const [sections, setSections] = useState<WritingSection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadLatest = async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/tasks/${taskId}/writing/sessions/latest`, { headers: { Authorization: `Bearer ${clientAuth.getToken()}` } });
      if (res.status === 404) {
        setSession(null);
        setSections([]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const latest = await res.json() as WritingSession;
      setSession(latest);

      const sectionsRes = await fetch(`${API_BASE}/tasks/${taskId}/writing/sessions/${latest.id}/sections`, { headers: { Authorization: `Bearer ${clientAuth.getToken()}` } });
      if (!sectionsRes.ok) throw new Error(`HTTP ${sectionsRes.status}`);
      const data = await sectionsRes.json() as WritingSection[];
      setSections(data.sort((a, b) => a.orderIndex - b.orderIndex));
      setStatus(latest.status === 'DONE' ? 'success' : 'running');
    } catch (err) {
      setError(getApiErrorMessage(err, '加载正文会话失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!taskId || submitting) return;
    try {
      setSubmitting(true);
      setStatus('queued');
      setError(null);

      const response = await fetch(`${API_BASE}/tasks/${taskId}/writing/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clientAuth.getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          if (chunk.includes('event: session.started') || chunk.includes('event: section.started')) setStatus('running');
          if (chunk.includes('event: session.completed')) setStatus('success');
          if (chunk.includes('event: session.error')) {
            setStatus('failed');
            setError('正文生成失败，请稍后重试。');
          }
        }
      }

      if (status !== 'failed') {
        setStatus('success');
        await loadLatest();
      }
    } catch (err) {
      setStatus('failed');
      setError(getApiErrorMessage(err, '正文生成失败，请稍后重试。'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <header>
        <h2 className="text-xl font-semibold">论文正文生成（分阶段）</h2>
        <p className="text-sm text-slate-600">状态：{status}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void handleStart()} disabled={!taskId || submitting} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{submitting ? '生成中...' : '开始生成正文'}</button>
        <button type="button" onClick={() => void loadLatest()} disabled={!taskId || loading} className="rounded border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-60">{loading ? '刷新中...' : '刷新阶段结果'}</button>
      </div>

      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
      {!error && !session && !loading ? <p className="text-sm text-slate-600">暂无正文会话，点击“开始生成正文”发起任务。</p> : null}

      {session ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">会话：{session.id}｜后端状态：{session.status}</p>
          {sections.length ? (
            <ul className="space-y-2">
              {sections.map((section) => (
                <li key={section.id} className="rounded border border-slate-200 p-3">
                  <p className="text-sm font-medium">{section.orderIndex + 1}. {section.title}</p>
                  <p className="text-xs text-slate-500">阶段状态：{section.status}</p>
                  <p className="mt-1 line-clamp-3 text-sm text-slate-700">{section.editedContent || section.generatedContent || '内容生成中...'}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-600">当前会话暂无章节内容。</p>}
        </div>
      ) : null}
    </section>
  );
}
