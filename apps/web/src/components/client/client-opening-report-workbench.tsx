'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    revisions?: Array<{
      id: string;
      type: 'ADVISOR_REWRITE' | 'MANUAL_EDIT';
      feedback: string | null;
      beforeContent: string | null;
      afterContent: string | null;
      createdAt: string;
    }>;
  }>;
};

type StageStatus = 'idle' | 'queued' | 'running' | 'success' | 'failed';
type DialogMode = 'view' | 'revise' | 'edit';

const API_BASE = '/api';

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.replace(/[\u0000-\u001F\u007F]/g, '').trim());
}

function buildAuthHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const token = clientAuth.getToken();
  const normalized = token ? token.trim().replace(/\s+/g, '') : '';
  if (normalized) headers.Authorization = `Bearer ${normalized}`;
  return headers;
}

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
  onReadyToProceedChange,
}: {
  taskId?: string;
  taskTitle?: string | null;
  onConfirmed?: () => void;
  onReadyToProceedChange?: (ready: boolean) => void;
}) {
  const [status, setStatus] = useState<StageStatus>('idle');
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [progressHint, setProgressHint] = useState<string>('');
  const [generationSections, setGenerationSections] = useState<
    Array<{ key: string; title: string; index: number }>
  >([]);
  const [sectionProgress, setSectionProgress] = useState<Record<string, number>>({});
  const [sectionStatus, setSectionStatus] = useState<Record<string, 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'>>(
    {},
  );
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const totalSectionsRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [report, setReport] = useState<OpeningReportResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [schoolOrRegion, setSchoolOrRegion] = useState('');
  const [educationStage, setEducationStage] = useState('');
  const [templateRequirements, setTemplateRequirements] = useState('');

  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>('view');
  const [advisorFeedback, setAdvisorFeedback] = useState('');
  const [editedText, setEditedText] = useState('');
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const reportTitle = useMemo(() => (taskTitle ?? '').trim() || '开题报告', [taskTitle]);
  const activeSection = useMemo(() => {
    if (!report || !activeSectionKey) return null;
    return report.sections?.find((s) => s.sectionKey === activeSectionKey) ?? null;
  }, [activeSectionKey, report]);
  const activeSectionStats = useMemo(() => {
    const revisions = activeSection?.revisions ?? [];
    const advisorRewriteCount = revisions.filter((r) => r.type === 'ADVISOR_REWRITE').length;
    const manualEditCount = revisions.filter((r) => r.type === 'MANUAL_EDIT').length;
    return { advisorRewriteCount, manualEditCount, total: revisions.length };
  }, [activeSection]);
  const additionalRequirements = useMemo(() => {
    return buildAdditionalRequirements({
      schoolOrRegion,
      educationStage,
      templateRequirements,
    });
  }, [educationStage, schoolOrRegion, templateRequirements]);

  const loadReport = useCallback(async (): Promise<OpeningReportResponse | null> => {
    if (!taskId) return null;
    try {
      setLoadingReport(true);
      setError(null);
      const tid = encodePathSegment(taskId);
      const res = await fetch(`${API_BASE}/tasks/${tid}/opening-report`, { headers: buildAuthHeaders() });
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await res.json()) as { message?: unknown };
          const msg = typeof data?.message === 'string' ? data.message : '';
          if (res.status === 400 && msg.includes('开题报告不存在')) {
            setReport(null);
            setStatus('idle');
            onReadyToProceedChange?.(false);
            return null;
          }
          throw data;
        }
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as OpeningReportResponse;
      setReport(data);
      setStatus('success');
      const ready = (data.sections ?? []).some((s) => (s.content ?? '').trim().length > 0);
      onReadyToProceedChange?.(ready);
      return data;
    } catch (err) {
      setError(getApiErrorMessage(err, '加载开题报告失败，请稍后重试。'));
      onReadyToProceedChange?.(false);
      return null;
    } finally {
      setLoadingReport(false);
    }
  }, [onReadyToProceedChange, taskId]);

  const loadReportWithRetry = useCallback(async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const data = await loadReport();
      const hasAnyContent = (data?.sections ?? []).some((s) => (s.content ?? '').trim().length > 0);
      if (hasAnyContent) return;
      await new Promise((r) => window.setTimeout(r, 400));
    }
  }, [loadReport]);

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
      setProgressPercent(0);
      setProgressHint('准备开始生成…');
      const tid = encodePathSegment(taskId);
      const response = await fetch(`${API_BASE}/tasks/${tid}/opening-report/generate`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          additionalRequirements: additionalRequirements ? additionalRequirements.slice(0, 2000) : undefined,
        }),
      });

      if (!response.ok || !response.body) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await response.json()) as unknown;
          throw data;
        }
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let hadError = false;

      const handleSseChunk = (raw: string): { event: string; data: unknown } => {
        const lines = raw
          .split('\n')
          .map((l) => l.trimEnd())
          .filter((l) => l.length > 0);
        const eventLine = lines.find((l) => l.startsWith('event:'));
        const dataLines = lines.filter((l) => l.startsWith('data:'));
        const event = eventLine ? eventLine.replace(/^event:\s*/, '').trim() : '';
        const dataText = dataLines
          .map((l) => l.replace(/^data:\s*/, ''))
          .join('\n')
          .trim();
        let data: unknown = null;
        if (dataText) {
          try {
            data = JSON.parse(dataText) as unknown;
          } catch {
            data = dataText;
          }
        }
        return { event, data };
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const parsed = handleSseChunk(chunk);
          if (parsed.event === 'start') {
            const d = parsed.data as {
              totalSections?: unknown;
              sections?: unknown;
            } | null;
            const total = d && typeof d.totalSections === 'number' ? d.totalSections : 0;
            const sections =
              d && Array.isArray(d.sections)
                ? (d.sections as Array<{ key?: unknown; title?: unknown; index?: unknown }>)
                    .map((s) => ({
                      key: typeof s.key === 'string' ? s.key : '',
                      title: typeof s.title === 'string' ? s.title : '',
                      index: typeof s.index === 'number' ? s.index : 0,
                    }))
                    .filter((s) => s.key)
                : [];
            totalSectionsRef.current = total > 0 ? total : sections.length;
            setGenerationSections(sections.sort((a, b) => a.index - b.index));
            setSectionProgress(() => {
              const next: Record<string, number> = {};
              for (const s of sections) next[s.key] = 0;
              return next;
            });
            setSectionStatus(() => {
              const next: Record<string, 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'> = {};
              for (const s of sections) next[s.key] = 'PENDING';
              return next;
            });
            setSectionErrors({});
            setStatus('running');
            setProgressPercent(0);
            setProgressHint('开始生成…');
          }

          if (parsed.event === 'section_start') {
            const d = parsed.data as { sectionTitle?: unknown; sectionKey?: unknown } | null;
            const title = d && typeof d.sectionTitle === 'string' ? d.sectionTitle : '';
            const key = d && typeof d.sectionKey === 'string' ? d.sectionKey : '';
            setStatus('running');
            setProgressHint(title ? `正在生成：${title}` : '正在生成…');
            if (key) {
              setSectionStatus((prev) => ({ ...prev, [key]: 'RUNNING' }));
              setSectionErrors((prev) => {
                if (!prev[key]) return prev;
                const next = { ...prev };
                delete next[key];
                return next;
              });
              setSectionProgress((prev) => ({ ...prev, [key]: Math.max(prev[key] ?? 0, 1) }));
            }
          }

          if (parsed.event === 'progress') {
            const d = parsed.data as {
              overallPercent?: unknown;
              currentSection?: unknown;
              sectionPercent?: unknown;
              completedSections?: unknown;
              totalSections?: unknown;
            } | null;
            const overallPercent = d && typeof d.overallPercent === 'number' ? d.overallPercent : null;
            const currentSection = d && typeof d.currentSection === 'string' ? d.currentSection : '';
            const sectionPercent = d && typeof d.sectionPercent === 'number' ? d.sectionPercent : null;
            const completedSections = d && typeof d.completedSections === 'number' ? d.completedSections : null;
            const totalSections = d && typeof d.totalSections === 'number' ? d.totalSections : totalSectionsRef.current;
            if (currentSection && typeof sectionPercent === 'number' && Number.isFinite(sectionPercent)) {
              setSectionProgress((prev) => ({
                ...prev,
                [currentSection]: Math.max(prev[currentSection] ?? 0, Math.max(0, Math.min(100, Math.round(sectionPercent)))),
              }));
            }
            const computedOverall =
              totalSections && totalSections > 0 && typeof sectionPercent === 'number' && typeof completedSections === 'number'
                ? ((Math.min(completedSections, totalSections) + Math.max(0, Math.min(100, sectionPercent)) / 100) / totalSections) * 100
                : null;
            const nextOverall =
              typeof overallPercent === 'number' && Number.isFinite(overallPercent) && overallPercent > 0
                ? overallPercent
                : computedOverall;
            if (typeof nextOverall === 'number' && Number.isFinite(nextOverall)) {
              setProgressPercent(Math.max(0, Math.min(100, Math.round(nextOverall))));
            }
            setStatus('running');
          }

          if (parsed.event === 'section_end') {
            const d = parsed.data as { sectionKey?: unknown; skipped?: unknown } | null;
            const key = d && typeof d.sectionKey === 'string' ? d.sectionKey : '';
            if (key) {
              setSectionProgress((prev) => ({ ...prev, [key]: 100 }));
              setSectionStatus((prev) => ({ ...prev, [key]: 'COMPLETED' }));
            }
          }

          if (parsed.event === 'done') {
            setStatus('success');
            setProgressPercent(100);
            setProgressHint('生成完成');
          }

          if (parsed.event === 'error') {
            hadError = true;
            const d = parsed.data as { message?: unknown; sectionKey?: unknown } | null;
            const msg = d && typeof d.message === 'string' ? d.message : '';
            const sectionKey = d && typeof d.sectionKey === 'string' ? d.sectionKey : '';
            if (sectionKey) {
              setSectionProgress((prev) => ({ ...prev, [sectionKey]: 100 }));
              setSectionStatus((prev) => ({ ...prev, [sectionKey]: 'FAILED' }));
              setSectionErrors((prev) => ({ ...prev, [sectionKey]: msg || '生成失败' }));
            }
            setStatus('failed');
            setError(msg || '开题报告生成失败，请稍后重试。');
          }
        }
      }

      if (!hadError) {
        setStatus('success');
        setProgressPercent(100);
        setProgressHint('生成完成');
        await loadReportWithRetry();
      } else {
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

  const closeDialog = () => {
    setActiveSectionKey(null);
    setDialogMode('view');
    setAdvisorFeedback('');
    setEditedText('');
    setDialogSubmitting(false);
  };

  const openViewDialog = (sectionKey: string) => {
    setDialogMode('view');
    setActiveSectionKey(sectionKey);
  };

  const openReviseDialog = (sectionKey: string) => {
    setDialogMode('revise');
    setAdvisorFeedback('');
    setActiveSectionKey(sectionKey);
  };

  const openEditDialog = (sectionKey: string) => {
    const section = report?.sections?.find((s) => s.sectionKey === sectionKey);
    setDialogMode('edit');
    setEditedText(section?.content ?? '');
    setActiveSectionKey(sectionKey);
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
      const tid = encodePathSegment(taskId);
      const res = await fetch(`${API_BASE}/tasks/${tid}/opening-report/export`, {
        method: 'GET',
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

  const handleReviseSection = async (sectionKey: string, feedback: string) => {
    if (!taskId || dialogSubmitting) return;
    const payload = { feedback: feedback.trim().slice(0, 500) };
    if (!payload.feedback) {
      setError('请先填写导师意见后再改写。');
      return;
    }

    try {
      setDialogSubmitting(true);
      setError(null);
      const tid = encodePathSegment(taskId);
      const sk = encodePathSegment(sectionKey);
      const response = await fetch(
        `${API_BASE}/tasks/${tid}/opening-report/sections/${sk}/retry`,
        {
          method: 'POST',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            ...payload,
            additionalRequirements: additionalRequirements ? additionalRequirements.slice(0, 2000) : undefined,
          }),
        },
      );

      if (!response.ok || !response.body) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await response.json()) as unknown;
          throw data;
        }
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
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
          if (chunk.includes('event: error')) {
            throw new Error('导师意见改写失败，请稍后重试。');
          }
        }
      }

      await loadReport();
      showToast('已按导师意见改写');
      setAdvisorFeedback('');
      setDialogMode('view');
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '导师意见改写失败，请稍后重试。'));
    } finally {
      setDialogSubmitting(false);
    }
  };

  const handleSaveSectionEdit = async (sectionKey: string, content: string) => {
    if (!taskId || dialogSubmitting) return;
    const normalized = content.trim();
    if (!normalized) {
      setError('请输入内容后再保存。');
      return;
    }

    try {
      setDialogSubmitting(true);
      setError(null);
      const tid = encodePathSegment(taskId);
      const sk = encodePathSegment(sectionKey);
      const res = await fetch(
        `${API_BASE}/tasks/${tid}/opening-report/sections/${sk}`,
        {
          method: 'PATCH',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ content: normalized }),
        },
      );
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await res.json()) as unknown;
          throw data;
        }
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      await loadReport();
      showToast('已保存本节修改');
      setDialogMode('view');
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '保存失败，请稍后重试。'));
    } finally {
      setDialogSubmitting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <header>
        <h2 className="text-xl font-semibold">开题报告生成</h2>
        <p className="text-sm text-slate-600">状态：{status}</p>
      </header>

      {typeof progressPercent === 'number' && (status === 'queued' || status === 'running') ? (
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

          {generationSections.length ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-slate-700">分项进度</p>
              <ul className="space-y-2">
                {generationSections.map((s) => {
                  const p = sectionProgress[s.key] ?? 0;
                  const st = sectionStatus[s.key] ?? 'PENDING';
                  const errMsg = sectionErrors[s.key] ?? '';
                  return (
                    <li key={s.key} className="rounded border border-slate-200 bg-slate-50 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-700">{s.title || s.key}</p>
                        <p className="text-[11px] text-slate-500">
                          {st === 'FAILED' ? '失败' : st === 'COMPLETED' ? '完成' : st === 'RUNNING' ? '生成中' : '等待中'}｜{Math.min(100, Math.max(0, Math.round(p)))}%
                        </p>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-white">
                        <div
                          className={
                            st === 'FAILED'
                              ? 'h-1.5 rounded bg-red-500'
                              : st === 'COMPLETED'
                                ? 'h-1.5 rounded bg-emerald-600'
                                : 'h-1.5 rounded bg-sky-500'
                          }
                          style={{ width: `${Math.min(100, Math.max(0, p))}%` }}
                        />
                      </div>
                      {st === 'FAILED' && errMsg ? (
                        <p className="mt-1 text-[11px] text-red-600">{errMsg}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

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
                        onClick={() => openViewDialog(section.sectionKey)}
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        查看全文
                      </button>
                      <button
                        type="button"
                        onClick={() => openReviseDialog(section.sectionKey)}
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        导师意见改写
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditDialog(section.sectionKey)}
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        手动修改
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
          {report.fullContent && (status === 'success' || report.status === 'COMPLETED') ? (
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-medium text-slate-800">开题报告全文</p>
              <pre className="whitespace-pre-wrap break-words text-sm text-slate-800">
                {report.fullContent.trim()}
              </pre>
            </div>
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
                <p className="mt-1 text-xs text-slate-500">
                  模式：
                  {dialogMode === 'view'
                    ? '查看'
                    : dialogMode === 'revise'
                      ? '导师意见改写'
                      : '手动修改'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openReviseDialog(activeSection.sectionKey)}
                  className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  disabled={dialogSubmitting}
                >
                  导师意见改写
                </button>
                <button
                  type="button"
                  onClick={() => openEditDialog(activeSection.sectionKey)}
                  className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  disabled={dialogSubmitting}
                >
                  手动修改
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopySection(activeSection.sectionKey)}
                  className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  复制本节
                </button>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
                  disabled={dialogSubmitting}
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4">
              {(() => {
                const historyPanel = (
                  <aside className="space-y-3 rounded border border-slate-200 bg-white p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-900">调整记录</p>
                      <p className="text-xs text-slate-600">
                        导师改写：{activeSectionStats.advisorRewriteCount} 次｜
                        手动修改：{activeSectionStats.manualEditCount} 次｜
                        合计：{activeSectionStats.total} 次
                      </p>
                    </div>

                    {(activeSection.revisions ?? []).length ? (
                      <div className="max-h-[54vh] space-y-2 overflow-auto">
                        {(activeSection.revisions ?? []).map((r) => (
                          <div key={r.id} className="rounded border border-slate-200 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium text-slate-800">
                                {r.type === 'ADVISOR_REWRITE' ? '导师意见改写' : '手动修改'}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                              </p>
                            </div>
                            {r.feedback ? (
                              <p className="mt-2 whitespace-pre-wrap text-xs text-slate-700">
                                导师意见：{r.feedback}
                              </p>
                            ) : null}
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-slate-700">
                                查看改写前后内容
                              </summary>
                              <div className="mt-2 space-y-2">
                                <div className="rounded border border-slate-200 bg-slate-50 p-2">
                                  <p className="text-[11px] text-slate-500">改写前</p>
                                  <pre className="whitespace-pre-wrap break-words text-xs text-slate-800">
                                    {(r.beforeContent ?? '').trim() || '（无）'}
                                  </pre>
                                </div>
                                <div className="rounded border border-slate-200 bg-slate-50 p-2">
                                  <p className="text-[11px] text-slate-500">改写后</p>
                                  <pre className="whitespace-pre-wrap break-words text-xs text-slate-800">
                                    {(r.afterContent ?? '').trim() || '（无）'}
                                  </pre>
                                </div>
                              </div>
                            </details>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">暂无调整记录。</p>
                    )}
                  </aside>
                );

                const contentPanel = (
                  <div className="rounded border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-medium text-slate-600">改写后（当前内容）</p>
                    <pre className="whitespace-pre-wrap break-words text-sm text-slate-800">
                      {(activeSection.content ?? '').trim() || '暂无内容'}
                    </pre>
                  </div>
                );

                const revisePanel =
                  dialogMode === 'revise' ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">导师意见（用于改写）</label>
                      <textarea
                        value={advisorFeedback}
                        onChange={(e) => setAdvisorFeedback(e.target.value)}
                        className="h-28 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        placeholder="例如：补充研究意义；强化研究方法；语言更学术；增加数据与对比分析…"
                        maxLength={500}
                        disabled={dialogSubmitting}
                      />
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            void handleReviseSection(activeSection.sectionKey, advisorFeedback)
                          }
                          disabled={dialogSubmitting}
                          className="rounded bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                        >
                          {dialogSubmitting ? '处理中...' : '按导师意见改写'}
                        </button>
                      </div>
                    </div>
                  ) : null;

                const editPanel =
                  dialogMode === 'edit' ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">手动修改内容（将覆盖本节最终内容）</label>
                      <textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        className="h-48 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        placeholder="在这里直接编辑本节内容…"
                        maxLength={200000}
                        disabled={dialogSubmitting}
                      />
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            void handleSaveSectionEdit(activeSection.sectionKey, editedText)
                          }
                          disabled={dialogSubmitting}
                          className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
                        >
                          {dialogSubmitting ? '保存中...' : '保存修改'}
                        </button>
                      </div>
                    </div>
                  ) : null;

                if (dialogMode === 'view') {
                  return (
                    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
                      <div className="space-y-3">{contentPanel}</div>
                      {historyPanel}
                    </div>
                  );
                }

                return (
                  <div className="grid gap-4 md:grid-cols-[1fr_320px]">
                    <div className="space-y-3">
                      {historyPanel}
                      {revisePanel}
                      {editPanel}
                    </div>
                    <div className="space-y-3">{contentPanel}</div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
