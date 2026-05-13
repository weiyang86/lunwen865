'use client';

import { useState } from 'react';
import { clientAuth } from '@/lib/client/auth';
import { getApiErrorMessage } from '@/lib/client/api-error';

type OpeningReportResponse = {
  id: string;
  taskId: string;
  title: string;
  status: string;
  sections?: Array<{ sectionKey: string; title: string; content: string; status: string }>;
};

type StageStatus = 'idle' | 'queued' | 'running' | 'success' | 'failed';

export function ClientOpeningReportWorkbench({ taskId }: { taskId?: string }) {
  const [status, setStatus] = useState<StageStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [report, setReport] = useState<OpeningReportResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadReport = async () => {
    if (!taskId) return;
    try {
      setLoadingReport(true);
      setError(null);
      const res = await fetch(`${(process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '')}/api/tasks/${taskId}/opening-report`, {
        headers: {
          Authorization: `Bearer ${clientAuth.getToken()}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as OpeningReportResponse;
      setReport(data);
      setStatus('success');
    } catch (err) {
      setError(getApiErrorMessage(err, '加载开题报告失败，请稍后重试。'));
    } finally {
      setLoadingReport(false);
    }
  };

  const handleGenerate = async () => {
    if (!taskId || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      setStatus('queued');
      const response = await fetch(`${(process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '')}/api/tasks/${taskId}/opening-report/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientAuth.getToken()}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

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
          if (chunk.includes('event: progress')) setStatus('running');
          if (chunk.includes('event: done')) setStatus('success');
          if (chunk.includes('event: error')) {
            setStatus('failed');
            setError('开题报告生成失败，请稍后重试。');
          }
        }
      }

      if (status !== 'failed') {
        setStatus('success');
        await loadReport();
      }
    } catch (err) {
      setStatus('failed');
      setError(getApiErrorMessage(err, '开题报告生成失败，请稍后重试。'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <header>
        <h2 className="text-xl font-semibold">开题报告生成</h2>
        <p className="text-sm text-slate-600">状态：{status}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void handleGenerate()} disabled={!taskId || submitting} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{submitting ? '生成中...' : '生成开题报告'}</button>
        <button type="button" onClick={() => void loadReport()} disabled={!taskId || loadingReport} className="rounded border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-60">{loadingReport ? '加载中...' : '刷新结果'}</button>
      </div>

      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
      {!error && !report && !loadingReport ? <p className="text-sm text-slate-600">暂无开题报告，先发起生成。</p> : null}

      {report ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-700">标题：{report.title}</p>
          <p className="text-xs text-slate-500">后端状态：{report.status}</p>
          {report.sections?.length ? (
            <ul className="space-y-2">
              {report.sections.map((section) => (
                <li key={section.sectionKey} className="rounded border border-slate-200 p-3">
                  <p className="text-sm font-medium">{section.title}</p>
                  <p className="text-xs text-slate-500">状态：{section.status}</p>
                  <p className="mt-1 text-sm text-slate-700 line-clamp-3">{section.content || '暂无内容'}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
