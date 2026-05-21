'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clientAuth } from '@/lib/client/auth';
import { getApiErrorMessage } from '@/lib/client/api-error';

type AbstractRecord = {
  id: string;
  taskId: string;
  status: string;
  abstractZh: string | null;
  abstractEn: string | null;
  feedback: string | null;
  errorMessage: string | null;
  version: number;
  llmModel: string | null;
  createdAt: string;
  updatedAt: string;
};

type AbstractRevision = {
  id: string;
  taskId: string;
  abstractId: string | null;
  type: 'GENERATE' | 'REWRITE' | 'MANUAL_EDIT';
  feedback: string | null;
  fromVersion: number | null;
  toVersion: number | null;
  beforeZh: string | null;
  beforeEn: string | null;
  afterZh: string | null;
  afterEn: string | null;
  createdAt: string;
};

const API_BASE = '/api';

function buildAuthHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const token = clientAuth.getToken();
  const normalized = token ? token.trim().replace(/\s+/g, '') : '';
  if (normalized) headers.Authorization = `Bearer ${normalized}`;
  return headers;
}

export function ClientAbstractWorkbench({
  taskId,
  onConfirmed,
}: {
  taskId?: string;
  onConfirmed?: () => void;
}) {
  const [record, setRecord] = useState<AbstractRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [progressHint, setProgressHint] = useState('');
  const progressTimerRef = useRef<number | null>(null);
  const progressStartedAtRef = useRef<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [revisions, setRevisions] = useState<AbstractRevision[]>([]);
  const [revisionStats, setRevisionStats] = useState<{
    generateCount: number;
    rewriteCount: number;
    manualEditCount: number;
    total: number;
  } | null>(null);

  const [feedback, setFeedback] = useState('');
  const [editZh, setEditZh] = useState('');
  const [editEn, setEditEn] = useState('');

  const title = useMemo(() => '摘要生成（中英文）', []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1500);
  };

  const stopProgress = useCallback(() => {
    if (progressTimerRef.current != null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    progressStartedAtRef.current = null;
  }, []);

  const startProgress = useCallback(() => {
    stopProgress();
    progressStartedAtRef.current = Date.now();
    setProgressPercent(0);
    setProgressHint('开始生成摘要…');
    progressTimerRef.current = window.setInterval(() => {
      const startedAt = progressStartedAtRef.current;
      if (!startedAt) return;
      const elapsed = Date.now() - startedAt;
      let p = 0;
      if (elapsed < 3000) {
        p = (elapsed / 3000) * 45;
      } else if (elapsed < 9000) {
        p = 45 + ((elapsed - 3000) / 6000) * 40;
      } else {
        p = 85 + Math.min(((elapsed - 9000) / 15000) * 10, 10);
      }
      const percent = Math.max(0, Math.min(95, Math.round(p)));
      setProgressPercent(percent);
      if (percent < 35) setProgressHint('生成中…');
      else if (percent < 70) setProgressHint('组织摘要结构…');
      else if (percent < 90) setProgressHint('润色与一致性校验…');
      else setProgressHint('即将完成…');
    }, 500);
  }, [stopProgress]);

  useEffect(() => {
    return () => stopProgress();
  }, [stopProgress]);

  const loadLatest = useCallback(async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/tasks/${taskId}/abstract`, {
        headers: buildAuthHeaders(),
      });
      if (res.status === 404) {
        setRecord(null);
        setEditZh('');
        setEditEn('');
        return;
      }
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await res.json()) as unknown;
          throw data;
        }
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as AbstractRecord;
      setRecord(data);
      setEditZh(data.abstractZh ?? '');
      setEditEn(data.abstractEn ?? '');
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '加载摘要失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const loadHistory = useCallback(async () => {
    if (!taskId) return;
    try {
      setHistoryLoading(true);
      const res = await fetch(`${API_BASE}/tasks/${taskId}/abstract/history`, {
        headers: buildAuthHeaders(),
      });
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await res.json()) as unknown;
          throw data;
        }
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        revisions: AbstractRevision[];
        stats?: {
          generateCount: number;
          rewriteCount: number;
          manualEditCount: number;
          total: number;
        };
      };
      setRevisions(Array.isArray(data.revisions) ? data.revisions : []);
      setRevisionStats(data.stats ?? null);
    } catch {
      setRevisions([]);
      setRevisionStats(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadLatest();
    void loadHistory();
  }, [loadHistory, loadLatest]);

  const handleGenerate = async () => {
    if (!taskId || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      startProgress();
      const res = await fetch(`${API_BASE}/tasks/${taskId}/abstract/generate`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          feedback: feedback.trim() ? feedback.trim().slice(0, 2000) : undefined,
        }),
      });
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await res.json()) as unknown;
          throw data;
        }
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as AbstractRecord;
      setRecord(data);
      setEditZh(data.abstractZh ?? '');
      setEditEn(data.abstractEn ?? '');
      setFeedback('');
      stopProgress();
      setProgressPercent(100);
      setProgressHint('生成完成');
      showToast('摘要已生成');
      void loadHistory();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '生成摘要失败，请稍后重试。'));
      stopProgress();
      setProgressPercent(null);
      setProgressHint('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!taskId || saving) return;
    const zh = editZh.trim();
    const en = editEn.trim();
    if (!zh && !en) {
      setError('请输入中文或英文摘要。');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`${API_BASE}/tasks/${taskId}/abstract`, {
        method: 'PATCH',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          abstractZh: zh || undefined,
          abstractEn: en || undefined,
        }),
      });
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await res.json()) as unknown;
          throw data;
        }
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as AbstractRecord;
      setRecord(data);
      setEditZh(data.abstractZh ?? '');
      setEditEn(data.abstractEn ?? '');
      showToast('已保存摘要');
      void loadHistory();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '保存摘要失败，请稍后重试。'));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!taskId || confirming) return;
    if (!record) {
      setError('请先生成摘要后再确认。');
      return;
    }
    try {
      setConfirming(true);
      setError(null);
      const res = await fetch(`${API_BASE}/tasks/${taskId}/abstract/confirm`, {
        method: 'POST',
        headers: buildAuthHeaders(),
      });
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await res.json()) as unknown;
          throw data;
        }
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      showToast('已确认摘要');
      onConfirmed?.();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '确认摘要失败，请稍后重试。'));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="text-sm text-slate-600">
            生成中文摘要与英文摘要；可填写导师建议后重生成，也可手工修改保存。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadLatest()}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            disabled={loading}
          >
            刷新
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
            disabled={!taskId || !record || confirming}
          >
            {confirming ? '确认中...' : '确认摘要'}
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
            disabled={!taskId || submitting}
          >
            {submitting ? '生成中...' : record ? '按建议重生成' : '生成摘要'}
          </button>
        </div>
      </header>

      {typeof progressPercent === 'number' ? (
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-700">{progressHint || '生成中…'}</p>
            <p className="text-sm font-medium text-slate-900">{progressPercent}%</p>
          </div>
          <div className="mt-2 h-2 w-full rounded bg-slate-200">
            <div
              className="h-2 rounded bg-emerald-600 transition-[width]"
              style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      {toast ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {toast}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm md:col-span-2">
          导师建议（用于重生成，选填）
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="mt-1 h-24 w-full rounded border border-slate-300 px-3 py-2"
            placeholder="例如：突出研究方法与结论；英文摘要需更学术；避免口语化表达……"
            disabled={submitting}
            maxLength={2000}
          />
        </label>

        <label className="text-sm md:col-span-1">
          中文摘要
          <textarea
            value={editZh}
            onChange={(e) => setEditZh(e.target.value)}
            className="mt-1 h-64 w-full rounded border border-slate-300 px-3 py-2"
            placeholder="生成后可在此处微调并保存"
            maxLength={20000}
          />
        </label>

        <label className="text-sm md:col-span-1">
          英文摘要
          <textarea
            value={editEn}
            onChange={(e) => setEditEn(e.target.value)}
            className="mt-1 h-64 w-full rounded border border-slate-300 px-3 py-2"
            placeholder="Generated abstract in English"
            maxLength={20000}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {record
            ? `版本：v${record.version}；状态：${record.status}${record.llmModel ? `；模型：${record.llmModel}` : ''}`
            : '尚未生成摘要'}
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !taskId}
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-60"
        >
          {saving ? '保存中...' : '保存修改'}
        </button>
      </div>

      {loading ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          加载中...
        </div>
      ) : null}

      <div className="rounded border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">摘要调整记录</p>
            {revisionStats ? (
              <p className="mt-1 text-xs text-slate-600">
                生成：{revisionStats.generateCount} 次｜重生成：{revisionStats.rewriteCount} 次｜手动修改：{revisionStats.manualEditCount} 次｜合计：{revisionStats.total} 次
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-600">记录摘要的修改意见与修改结果，便于追溯。</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={historyLoading}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
          >
            {historyLoading ? '刷新中...' : '刷新记录'}
          </button>
        </div>

        {revisions.length ? (
          <div className="mt-3 space-y-2">
            {revisions.map((r) => (
              <div key={r.id} className="rounded border border-slate-200 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-800">
                    {r.type === 'GENERATE'
                      ? '生成'
                      : r.type === 'REWRITE'
                        ? '按意见重生成'
                        : '手动修改'}
                    {typeof r.toVersion === 'number' ? `（v${r.toVersion}）` : ''}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                  </p>
                </div>
                {r.feedback ? (
                  <p className="mt-2 whitespace-pre-wrap text-xs text-slate-700">
                    修改意见：{r.feedback}
                  </p>
                ) : null}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-700">
                    查看修改前后
                  </summary>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div className="rounded border border-slate-200 bg-slate-50 p-2">
                      <p className="text-[11px] text-slate-500">修改前（中文）</p>
                      <pre className="whitespace-pre-wrap break-words text-xs text-slate-800">
                        {(r.beforeZh ?? '').trim() || '（无）'}
                      </pre>
                      <p className="mt-2 text-[11px] text-slate-500">修改前（英文）</p>
                      <pre className="whitespace-pre-wrap break-words text-xs text-slate-800">
                        {(r.beforeEn ?? '').trim() || '（无）'}
                      </pre>
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 p-2">
                      <p className="text-[11px] text-slate-500">修改后（中文）</p>
                      <pre className="whitespace-pre-wrap break-words text-xs text-slate-800">
                        {(r.afterZh ?? '').trim() || '（无）'}
                      </pre>
                      <p className="mt-2 text-[11px] text-slate-500">修改后（英文）</p>
                      <pre className="whitespace-pre-wrap break-words text-xs text-slate-800">
                        {(r.afterEn ?? '').trim() || '（无）'}
                      </pre>
                    </div>
                  </div>
                </details>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-600">暂无历史记录。</p>
        )}
      </div>
    </section>
  );
}
