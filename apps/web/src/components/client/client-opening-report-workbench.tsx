'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientAuth } from '@/lib/client/auth';
import { getApiErrorMessage } from '@/lib/client/api-error';

type OpeningReportResponse = {
  id: string;
  taskId: string;
  status: string;
  fullContent?: string | null;
  totalWordCount?: number;
  sections?: Array<{
    sectionKey: string;
    sectionTitle: string;
    sectionIndex?: number;
    content: string | null;
    status: string;
  }>;
};

type StageStatus = 'idle' | 'queued' | 'running' | 'success' | 'failed';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    void 0;
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function buildAdditionalRequirements(input: {
  schoolOrRegion: string;
  educationStage: string;
  templateRequirements: string;
}): string {
  const lines: string[] = [];
  const schoolOrRegion = input.schoolOrRegion.trim();
  const educationStage = input.educationStage.trim();
  const templateRequirements = input.templateRequirements.trim();

  if (schoolOrRegion) lines.push(`学校/地区：${schoolOrRegion}`);
  if (educationStage) lines.push(`学历阶段：${educationStage}`);
  if (templateRequirements) lines.push(`模板/内容项要求：${templateRequirements}`);

  return lines.join('\n');
}

function buildReportPlainText(reportTitle: string, report: OpeningReportResponse): string {
  const sections = report.sections ?? [];
  const blocks: string[] = [];
  const title = reportTitle.trim() || '开题报告';
  blocks.push(title);
  blocks.push('');

  for (const s of sections) {
    blocks.push(s.sectionTitle || s.sectionKey);
    blocks.push(s.content?.trim() || '（暂无内容）');
    blocks.push('');
  }

  return blocks.join('\n');
}

export function ClientOpeningReportWorkbench({
  taskId,
  taskTitle,
  onConfirmed,
}: {
  taskId?: string;
  taskTitle?: string | null;
  onConfirmed?: () => void;
}) {
  const [status, setStatus] = useState<StageStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [report, setReport] = useState<OpeningReportResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [schoolOrRegion, setSchoolOrRegion] = useState('');
  const [educationStage, setEducationStage] = useState('');
  const [templateRequirements, setTemplateRequirements] = useState('');

  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const reportTitle = useMemo(() => (taskTitle ?? '').trim() || '开题报告', [taskTitle]);
  const activeSection = useMemo(() => {
    if (!report || !activeSectionKey) return null;
    return report.sections?.find((s) => s.sectionKey === activeSectionKey) ?? null;
  }, [activeSectionKey, report]);
  const additionalRequirements = useMemo(() => {
    return buildAdditionalRequirements({
      schoolOrRegion,
      educationStage,
      templateRequirements,
    });
  }, [educationStage, schoolOrRegion, templateRequirements]);

  const loadReport = useCallback(async () => {
    if (!taskId) return;
    try {
      setLoadingReport(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/opening-report`, {
        headers: {
          Authorization: `Bearer ${clientAuth.getToken()}`,
        },
      });
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await res.json()) as { message?: unknown };
          const msg = typeof data?.message === 'string' ? data.message : '';
          if (res.status === 400 && msg.includes('开题报告不存在')) {
            setReport(null);
            setStatus('idle');
            return;
          }
          throw data;
        }
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as OpeningReportResponse;
      setReport(data);
      setStatus('success');
    } catch (err) {
      setError(getApiErrorMessage(err, '加载开题报告失败，请稍后重试。'));
    } finally {
      setLoadingReport(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    void loadReport();
  }, [loadReport, taskId]);

  const handleGenerate = async () => {
    if (!taskId || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      setStatus('queued');
      const response = await fetch(`${API_BASE}/api/tasks/${taskId}/opening-report/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientAuth.getToken()}`,
        },
        body: JSON.stringify({
          additionalRequirements: additionalRequirements ? additionalRequirements.slice(0, 2000) : undefined,
        }),
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

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1500);
  };

  const handleCopySection = async (sectionKey: string) => {
    const section = report?.sections?.find((s) => s.sectionKey === sectionKey);
    if (!section) return;
    const ok = await copyToClipboard(section.content?.trim() || '');
    showToast(ok ? '已复制本节内容' : '复制失败，请重试');
  };

  const handleCopyAll = async () => {
    if (!report) return;
    const text = buildReportPlainText(reportTitle, report);
    const ok = await copyToClipboard(text);
    showToast(ok ? '已复制全文（可直接粘贴到 Word）' : '复制失败，请重试');
  };

  const handleExportWord = async () => {
    if (!taskId || exporting) return;
    try {
      setExporting(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/opening-report/export`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${clientAuth.getToken()}` },
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
      const blob = await res.blob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportTitle}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('已开始下载 Word');
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '导出 Word 失败，请稍后重试。'));
    } finally {
      setExporting(false);
    }
  };

  const handleConfirm = () => {
    if (!report) return;
    const ok = window.confirm('确认该开题报告内容无误，并进入正文生成流程？');
    if (!ok) return;
    onConfirmed?.();
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <header>
        <h2 className="text-xl font-semibold">开题报告生成</h2>
        <p className="text-sm text-slate-600">状态：{status}</p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-medium text-slate-800">不同学校/地区/学历阶段模板差异</p>
        <p className="mt-1 text-xs text-slate-600">
          把学校要求的“内容项/目录/格式/字数/参考文献规范”等粘贴到这里，会作为额外约束参与生成。
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <div className="text-xs text-slate-600">学校/地区（可选）</div>
            <input
              value={schoolOrRegion}
              onChange={(e) => setSchoolOrRegion(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="例如：XX大学/XX省"
            />
          </label>
          <label className="space-y-1">
            <div className="text-xs text-slate-600">学历阶段（可选）</div>
            <input
              value={educationStage}
              onChange={(e) => setEducationStage(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="例如：本科/专升本/硕士"
            />
          </label>
          <label className="space-y-1 md:col-span-1">
            <div className="text-xs text-slate-600">模板/内容项要求（可选）</div>
            <textarea
              value={templateRequirements}
              onChange={(e) => setTemplateRequirements(e.target.value)}
              className="min-h-10 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="例如：需包含“研究现状/技术路线/进度计划表/经费预算”…"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void handleGenerate()} disabled={!taskId || submitting} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{submitting ? '生成中...' : '生成开题报告'}</button>
        <button type="button" onClick={() => void loadReport()} disabled={!taskId || loadingReport} className="rounded border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-60">{loadingReport ? '加载中...' : '刷新结果'}</button>
        <button type="button" onClick={() => void handleCopyAll()} disabled={!report} className="rounded border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-60">复制全文</button>
        <button type="button" onClick={() => void handleExportWord()} disabled={!report || exporting} className="rounded border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-60">{exporting ? '导出中...' : '导出 Word'}</button>
        <button type="button" onClick={handleConfirm} disabled={!report} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-60">确认并进入正文</button>
      </div>

      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
      {toast ? <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{toast}</p> : null}
      {!error && !report && !loadingReport ? <p className="text-sm text-slate-600">暂无开题报告，先发起生成。</p> : null}

      {report ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-700">标题：{reportTitle}</p>
          <p className="text-xs text-slate-500">后端状态：{report.status}</p>
          {report.sections?.length ? (
            <ul className="space-y-2">
              {report.sections.map((section) => (
                <li key={section.sectionKey} className="rounded border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{section.sectionTitle}</p>
                      <p className="text-xs text-slate-500">状态：{section.status}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveSectionKey(section.sectionKey)}
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        查看全文
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopySection(section.sectionKey)}
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        复制本节
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-700 line-clamp-3">{section.content || '暂无内容'}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {activeSection ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-lg">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{activeSection.sectionTitle}</p>
                <p className="mt-1 text-xs text-slate-500">状态：{activeSection.status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopySection(activeSection.sectionKey)}
                  className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  复制本节
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSectionKey(null)}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4">
              <pre className="whitespace-pre-wrap break-words text-sm text-slate-800">
                {(activeSection.content ?? '').trim() || '暂无内容'}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
