'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clientAuth } from '@/lib/client/auth';
import { getApiErrorMessage } from '@/lib/client/api-error';

type WritingSession = {
  id: string;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
};
type WritingSection = {
  id: string;
  title: string;
  summary?: string | null;
  status: string;
  orderIndex: number;
  expectedWords?: number;
  rawContent?: string | null;
  editedContent?: string | null;
  wordCount?: number;
  errorMessage?: string | null;
  retryCount?: number;
};
type WritingStageStatus = 'idle' | 'queued' | 'running' | 'success' | 'failed';
type DialogMode = 'view' | 'revise' | 'edit';
type ReferenceFormatted = string;

const API_BASE = '/api';

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.replace(/[\u0000-\u001F\u007F]/g, '').trim());
}

function buildAuthHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const token = clientAuth.getToken();
  const stripped = token
    ? token
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
    : '';
  const withoutBearer = stripped.toLowerCase().startsWith('bearer ')
    ? stripped.slice('bearer '.length).trim()
    : stripped;
  const normalized = withoutBearer.replace(/\s+/g, '');
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

function parseSseEventChunk(chunk: string): { event: string | null; data: string | null } {
  const lines = chunk.split('\n').map((l) => l.trimEnd());
  const eventLine = lines.find((l) => l.startsWith('event:'));
  const dataLine = lines.find((l) => l.startsWith('data:'));
  const event = eventLine ? eventLine.replace(/^event:\s*/, '').trim() : null;
  const data = dataLine ? dataLine.replace(/^data:\s*/, '') : null;
  return { event, data };
}

function parseContentDispositionFileName(header: string | null): string | null {
  if (!header) return null;
  const parts = header.split(';').map((p) => p.trim());
  const filenameStar = parts.find((p) => p.toLowerCase().startsWith('filename*='));
  if (filenameStar) {
    const raw = filenameStar.split('=')[1]?.trim() ?? '';
    const v = raw.replace(/^UTF-8''/i, '');
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  const filename = parts.find((p) => p.toLowerCase().startsWith('filename='));
  if (filename) {
    const raw = filename.split('=')[1]?.trim() ?? '';
    return raw.replace(/^"/, '').replace(/"$/, '');
  }
  return null;
}

function extractCitedIndices(content: string): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const re = /\[(\d{1,3})\]/g;
  for (const match of content.matchAll(re)) {
    const raw = match[1];
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function ClientWritingWorkbench({ taskId }: { taskId?: string }) {
  const [status, setStatus] = useState<WritingStageStatus>('idle');
  const [session, setSession] = useState<WritingSession | null>(null);
  const [sections, setSections] = useState<WritingSection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retryingSectionId, setRetryingSectionId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ percentage: number; completed: number; total: number } | null>(null);
  const [currentSectionTitle, setCurrentSectionTitle] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [sectionProgress, setSectionProgress] = useState<Record<string, number>>({});
  const currentSseSectionIdRef = useRef<string | null>(null);
  const sectionProgressTimerRef = useRef<number | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  const pollingStartedAtRef = useRef<number>(0);
  const pollingFailCountRef = useRef<number>(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('view');
  const [activeSection, setActiveSection] = useState<WritingSection | null>(null);
  const [advisorFeedback, setAdvisorFeedback] = useState('');
  const [editedText, setEditedText] = useState('');
  const [dialogSubmitting, setDialogSubmitting] = useState(false);

  const [refCount, setRefCount] = useState(15);
  const [refRecentYears, setRefRecentYears] = useState(5);
  const [refFocus, setRefFocus] = useState('');
  const [references, setReferences] = useState<ReferenceFormatted[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [referencesGenerating, setReferencesGenerating] = useState(false);

  const sortedSections = useMemo(
    () => sections.slice().sort((a, b) => a.orderIndex - b.orderIndex),
    [sections],
  );

  const stopSectionProgressTimer = useCallback(() => {
    if (sectionProgressTimerRef.current !== null) {
      window.clearInterval(sectionProgressTimerRef.current);
      sectionProgressTimerRef.current = null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current !== null) {
      window.clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopSectionProgressTimer();
      stopPolling();
    };
  }, [stopPolling, stopSectionProgressTimer]);

  const startSectionProgressTimer = useCallback((sectionId: string) => {
    stopSectionProgressTimer();
    currentSseSectionIdRef.current = sectionId;
    sectionProgressTimerRef.current = window.setInterval(() => {
      setSectionProgress((prev) => {
        const current = typeof prev[sectionId] === 'number' ? prev[sectionId] : 0;
        if (current >= 95) return prev;
        return { ...prev, [sectionId]: Math.min(95, current + 1) };
      });
    }, 250);
  }, [stopSectionProgressTimer]);

  const computedProgress = useMemo(() => {
    if (progress) return progress;
    if (!sortedSections.length) return null;
    const total = sortedSections.length;
    const completed = sortedSections.filter((s) => s.status === 'COMPLETED').length;
    const percentage = Math.round((completed / total) * 100);
    return { percentage, completed, total };
  }, [progress, sortedSections]);

  const citedIndexMap = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const s of sortedSections) {
      const content = s.editedContent || s.rawContent || '';
      map.set(s.id, extractCitedIndices(content));
    }
    return map;
  }, [sortedSections]);

  const loadLatest = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!taskId) return null;
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const tid = encodePathSegment(taskId);
      const res = await fetch(`${API_BASE}/tasks/${tid}/writing/sessions/latest`, {
        headers: buildAuthHeaders(),
      });
      if (res.status === 404) {
        setSession(null);
        setSections([]);
        setProgress(null);
        setCurrentSectionTitle(null);
        return { session: null as WritingSession | null, sections: [] as WritingSection[] };
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
      const latestText = await res.text();
      if (!latestText.trim()) {
        setSession(null);
        setSections([]);
        setProgress(null);
        setCurrentSectionTitle(null);
        return { session: null as WritingSession | null, sections: [] as WritingSection[] };
      }
      const latest = JSON.parse(latestText) as WritingSession;
      setSession(latest);

      const sid = encodePathSegment(latest.id);
      const sectionsRes = await fetch(`${API_BASE}/tasks/${tid}/writing/sessions/${sid}/sections`, {
        headers: buildAuthHeaders(),
      });
      if (!sectionsRes.ok) {
        const contentType = sectionsRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await sectionsRes.json()) as unknown;
          throw data;
        }
        const text = await sectionsRes.text();
        throw new Error(text || `HTTP ${sectionsRes.status}`);
      }
      const sectionsText = await sectionsRes.text();
      const data = sectionsText.trim() ? (JSON.parse(sectionsText) as WritingSection[]) : [];
      setSections(data);
      setSectionProgress((prev) => {
        const next: Record<string, number> = { ...prev };
        for (const s of data) {
          const existing = typeof next[s.id] === 'number' ? next[s.id] : null;
          if (s.status === 'COMPLETED') next[s.id] = 100;
          else if (existing === null) next[s.id] = 0;
        }
        return next;
      });
      setStatus(latest.status === 'COMPLETED' ? 'success' : 'running');
      return { session: latest, sections: data };
    } catch (err) {
      if (!silent) setError(getApiErrorMessage(err, '加载正文会话失败，请稍后重试。'));
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [taskId]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollingStartedAtRef.current = Date.now();
    pollingFailCountRef.current = 0;
    setStatus('running');
    pollingTimerRef.current = window.setInterval(() => {
      void (async () => {
        const data = await loadLatest({ silent: true });
        if (!data) {
          pollingFailCountRef.current += 1;
          if (pollingFailCountRef.current >= 3) {
            stopPolling();
            setStatus('failed');
            setError('无法连接到服务端接口（/api 代理或后端服务异常）。请确认已重启 web，并确保 api 正在运行。');
          }
          return;
        }
        const st = data?.session?.status ?? '';
        const errMsg = data?.session?.errorMessage ?? null;

        if (st === 'COMPLETED') {
          stopPolling();
          setStatus('success');
          return;
        }

        if (st === 'FAILED' || st === 'ERROR' || (errMsg && errMsg.trim())) {
          stopPolling();
          setStatus('failed');
          setError(errMsg?.trim() ? errMsg.trim() : '正文生成失败，请稍后重试。');
          return;
        }

        if (Date.now() - pollingStartedAtRef.current > 10 * 60 * 1000) {
          stopPolling();
          setStatus('failed');
          setError('正文生成超时（轮询超过 10 分钟仍未完成），请稍后重试。');
        }
      })();
    }, 1200);
  }, [loadLatest, stopPolling]);

  useEffect(() => {
    if (!taskId) return;
    void loadLatest();
  }, [loadLatest, taskId]);

  const loadReferences = useCallback(async () => {
    if (!taskId) return;
    try {
      setReferencesLoading(true);
      setError(null);
      const tid = encodePathSegment(taskId);
      const res = await fetch(`${API_BASE}/tasks/${tid}/references/formatted?style=gbt7714`, {
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
      const data = (await res.json()) as unknown;
      if (Array.isArray(data)) {
        setReferences(data.filter((x) => typeof x === 'string') as string[]);
      } else {
        setReferences([]);
      }
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '加载参考文献失败，请稍后重试。'));
    } finally {
      setReferencesLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    void loadReferences();
  }, [loadReferences, taskId]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1500);
  };

  const handleCopySection = async (section: WritingSection) => {
    const text = (section.editedContent || section.rawContent || '').trim();
    const ok = await copyToClipboard(text);
    showToast(ok ? '已复制本节内容' : '复制失败，请重试');
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setActiveSection(null);
    setAdvisorFeedback('');
    setEditedText('');
    setDialogSubmitting(false);
  };

  const openViewDialog = (section: WritingSection) => {
    setActiveSection(section);
    setDialogMode('view');
    setDialogOpen(true);
  };

  const openReviseDialog = (section: WritingSection) => {
    setActiveSection(section);
    setDialogMode('revise');
    setAdvisorFeedback('');
    setDialogOpen(true);
  };

  const openEditDialog = (section: WritingSection) => {
    setActiveSection(section);
    setDialogMode('edit');
    setEditedText(section.editedContent || section.rawContent || '');
    setDialogOpen(true);
  };

  const handleGenerateReferences = async () => {
    if (!taskId || referencesGenerating) return;
    try {
      setReferencesGenerating(true);
      setError(null);
      const tid = encodePathSegment(taskId);
      const res = await fetch(`${API_BASE}/tasks/${tid}/references/generate`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          count: refCount,
          recentYears: refRecentYears,
          focus: refFocus.trim() ? refFocus.trim().slice(0, 500) : undefined,
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
      showToast('已生成参考文献');
      await loadReferences();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '生成参考文献失败，请稍后重试。'));
    } finally {
      setReferencesGenerating(false);
    }
  };

  const handleSyncReferences = async () => {
    if (!taskId) return;
    try {
      setError(null);
      const tid = encodePathSegment(taskId);
      const res = await fetch(`${API_BASE}/tasks/${tid}/references/sync-from-content`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
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
      showToast('已同步正文引用关系');
      await loadReferences();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '同步引用关系失败，请稍后重试。'));
    }
  };

  const runWritingStream = async (response: Response) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('SSE stream not available');

    const decoder = new TextDecoder();
    let buffer = '';
    let failed = false;
    setProgress(null);
    setCurrentSectionTitle(null);
    stopSectionProgressTimer();
    currentSseSectionIdRef.current = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        const { event, data } = parseSseEventChunk(chunk);

        if (event === 'session.start' || event === 'section.start') setStatus('running');
        if (event === 'session.complete') setStatus('success');

        if (event === 'session.start' && data) {
          try {
            const parsed = JSON.parse(data) as { sessionId?: unknown };
            const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId : null;
            if (sessionId) {
              setSession((prev) => {
                if (prev?.id === sessionId) return prev;
                const now = new Date().toISOString();
                return { id: sessionId, status: 'RUNNING', createdAt: now, updatedAt: now };
              });
            }
          } catch {
            void 0;
          }
        }

        if (event === 'section.start' && data) {
          try {
            const parsed = JSON.parse(data) as { title?: unknown; sectionId?: unknown; index?: unknown };
            const title = typeof parsed.title === 'string' ? parsed.title : null;
            setCurrentSectionTitle(title);
            const sectionId = typeof parsed.sectionId === 'string' ? parsed.sectionId : null;
            const index = typeof parsed.index === 'number' ? parsed.index : null;
            if (sectionId) {
              setSections((prev) => {
                const exists = prev.find((s) => s.id === sectionId);
                if (exists) {
                  return prev.map((s) => (s.id === sectionId ? { ...s, status: 'GENERATING', title: title ?? s.title } : s));
                }
                const nowIndex = typeof index === 'number' ? index : prev.length;
                const newSection: WritingSection = {
                  id: sectionId,
                  title: title ?? `第${nowIndex + 1}节`,
                  status: 'GENERATING',
                  orderIndex: nowIndex,
                  summary: null,
                  expectedWords: undefined,
                  rawContent: null,
                  editedContent: null,
                  wordCount: undefined,
                  errorMessage: null,
                  retryCount: 0,
                };
                return [...prev, newSection];
              });
              setSectionProgress((prev) => ({
                ...prev,
                [sectionId]: Math.min(95, Math.max(0, prev[sectionId] ?? 0)),
              }));
              startSectionProgressTimer(sectionId);
            }
          } catch {
            void 0;
          }
        }

        if (event === 'progress' && data) {
          try {
            const parsed = JSON.parse(data) as {
              percentage?: unknown;
              completed?: unknown;
              total?: unknown;
            };
            const percentage = typeof parsed.percentage === 'number' ? parsed.percentage : null;
            const completed = typeof parsed.completed === 'number' ? parsed.completed : null;
            const total = typeof parsed.total === 'number' ? parsed.total : null;
            if (percentage !== null && completed !== null && total !== null) {
              setProgress({ percentage, completed, total });
              setSectionProgress((prev) => {
                if (!sortedSections.length) return prev;
                const next: Record<string, number> = { ...prev };
                for (const s of sortedSections.slice(0, Math.min(sortedSections.length, completed))) {
                  next[s.id] = 100;
                }
                const currentId = currentSseSectionIdRef.current;
                if (currentId && typeof next[currentId] === 'number' && next[currentId] >= 100) {
                  stopSectionProgressTimer();
                }
                return next;
              });
            }
          } catch {
            void 0;
          }
        }

        if (event === 'section.complete' && data) {
          try {
            const parsed = JSON.parse(data) as { sectionId?: unknown; wordCount?: unknown };
            const sectionId = typeof parsed.sectionId === 'string' ? parsed.sectionId : null;
            const wordCount = typeof parsed.wordCount === 'number' ? parsed.wordCount : null;
            if (sectionId) {
              setSections((prev) =>
                prev.map((s) =>
                  s.id === sectionId
                    ? { ...s, status: 'COMPLETED', wordCount: wordCount ?? s.wordCount, errorMessage: null }
                    : s,
                ),
              );
              setSectionProgress((prev) => ({ ...prev, [sectionId]: 100 }));
              if (currentSseSectionIdRef.current === sectionId) {
                stopSectionProgressTimer();
              }
            }
          } catch {
            void 0;
          }
        }

        if (event === 'section.failed' && data) {
          try {
            const parsed = JSON.parse(data) as { error?: unknown; sectionId?: unknown };
            const msg = typeof parsed.error === 'string' ? parsed.error : null;
            if (msg) setError(msg);
            const sectionId = typeof parsed.sectionId === 'string' ? parsed.sectionId : null;
            if (sectionId) {
              setSections((prev) =>
                prev.map((s) => (s.id === sectionId ? { ...s, status: 'FAILED', errorMessage: msg ?? s.errorMessage } : s)),
              );
              setSectionProgress((prev) => ({ ...prev, [sectionId]: 100 }));
              if (currentSseSectionIdRef.current === sectionId) stopSectionProgressTimer();
            }
          } catch {
            void 0;
          }
        }

        if (event === 'session.error') {
          failed = true;
          setStatus('failed');
          stopSectionProgressTimer();
          if (data) {
            try {
              const parsed = JSON.parse(data) as { error?: unknown; message?: unknown };
              const msg =
                typeof parsed.error === 'string'
                  ? parsed.error
                  : typeof parsed.message === 'string'
                    ? parsed.message
                    : null;
              setError(msg && msg.trim() ? msg.trim() : '正文生成失败，请稍后重试。');
            } catch {
              setError(data.trim() ? data.trim() : '正文生成失败，请稍后重试。');
            }
          } else {
            setError('正文生成失败，请稍后重试。');
          }
        }
      }
    }

    await loadLatest();
    if (!failed) setStatus('success');
  };

  const handleStartOrResume = async () => {
    if (!taskId || submitting) return;
    try {
      setSubmitting(true);
      setStatus('queued');
      setError(null);
      setProgress(null);
      setCurrentSectionTitle(null);
      const tid = encodePathSegment(taskId);

      const latest = session ?? (await (async () => {
        const res = await fetch(`${API_BASE}/tasks/${tid}/writing/sessions/latest`, {
          headers: buildAuthHeaders(),
        });
        if (res.status === 404) return null;
        if (!res.ok) return null;
        const text = await res.text();
        if (!text.trim()) return null;
        return JSON.parse(text) as WritingSession;
      })());

      const hasExisting = Boolean(latest?.id);
      const fromOrderIndex = sortedSections.find((s) => s.status !== 'COMPLETED')?.orderIndex ?? 0;
      const sid = latest?.id ? encodePathSegment(latest.id) : null;
      const url = hasExisting
        ? `${API_BASE}/tasks/${tid}/writing/sessions/${sid}/resume?fromOrderIndex=${encodeURIComponent(String(fromOrderIndex))}`
        : `${API_BASE}/tasks/${tid}/writing/start`;

      const response = await fetch(url, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await response.json()) as unknown;
          throw data;
        }
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      if (!response.body) {
        showToast('流式连接不可用，已切换为轮询模式');
        startPolling();
        return;
      }

      try {
        await runWritingStream(response);
      } catch {
        showToast('流式连接不可用，已切换为轮询模式');
        startPolling();
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, '正文生成失败，请稍后重试。');
      if (msg.includes('expected pattern')) {
        showToast('浏览器不支持该连接方式，已切换为轮询模式');
        startPolling();
        return;
      }
      setStatus('failed');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetrySection = async (section: WritingSection, feedback: string) => {
    if (!taskId || !session || retryingSectionId) return;
    try {
      setRetryingSectionId(section.id);
      setError(null);
      setSectionProgress((prev) => ({ ...prev, [section.id]: 0 }));
      startSectionProgressTimer(section.id);
      const tid = encodePathSegment(taskId);
      const sid = encodePathSegment(session.id);
      const secId = encodePathSegment(section.id);
      const res = await fetch(
        `${API_BASE}/tasks/${tid}/writing/sessions/${sid}/sections/${secId}/retry`,
        {
          method: 'POST',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ feedback: feedback.trim().slice(0, 500) || undefined }),
        },
      );
      if (!res.ok || !res.body) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await res.json()) as unknown;
          throw data;
        }
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const { event, data } = parseSseEventChunk(chunk);
          if (event === 'section.complete') {
            showToast('已完成本节重试');
          }
          if (event === 'session.error' && data) {
            try {
              const parsed = JSON.parse(data) as { error?: unknown };
              const msg = typeof parsed.error === 'string' ? parsed.error : null;
              if (msg) setError(msg);
            } catch {
              void 0;
            }
          }
        }
      }

      await loadLatest();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '重试失败，请稍后重试。'));
    } finally {
      setRetryingSectionId(null);
      stopSectionProgressTimer();
    }
  };

  const handleSaveEditedContent = async (section: WritingSection, content: string) => {
    if (!taskId) return;
    try {
      setDialogSubmitting(true);
      setError(null);
      const tid = encodePathSegment(taskId);
      const secId = encodePathSegment(section.id);
      const res = await fetch(`${API_BASE}/tasks/${tid}/writing/sections/${secId}`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content }),
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
      showToast('已保存本节修改');
      await loadLatest();
      closeDialog();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '保存失败，请稍后重试。'));
    } finally {
      setDialogSubmitting(false);
    }
  };

  const handleSubmitAdvisorFeedback = async (section: WritingSection, feedback: string) => {
    try {
      setDialogSubmitting(true);
      await handleRetrySection(section, feedback);
      closeDialog();
    } finally {
      setDialogSubmitting(false);
    }
  };

  const handleExportDocx = async () => {
    if (!taskId || exporting) return;
    try {
      setExporting(true);
      setError(null);
      const sessionId = session?.id ? `?sessionId=${encodeURIComponent(session.id)}` : '';
      const tid = encodePathSegment(taskId);
      const res = await fetch(`${API_BASE}/tasks/${tid}/writing/export${sessionId}`, {
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
      const fileName =
        parseContentDispositionFileName(res.headers.get('content-disposition')) ||
        '论文正文.docx';
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('已开始下载 Word');
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '导出失败，请稍后重试。'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">论文正文生成（分阶段）</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>状态：{status}</span>
              {currentSectionTitle ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                  当前：{currentSectionTitle}
                </span>
              ) : null}
            </div>
          </div>
          {computedProgress ? (
            <div className="w-full max-w-sm space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>进度</span>
                <span>
                  {computedProgress.percentage}%（{computedProgress.completed}/{computedProgress.total}）
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
                <div
                  className="h-2 rounded bg-emerald-500"
                  style={{ width: `${Math.min(100, Math.max(0, computedProgress.percentage))}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void handleStartOrResume()} disabled={!taskId || submitting} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{submitting ? '处理中...' : (session ? '继续生成正文' : '开始生成正文')}</button>
        <button type="button" onClick={() => void loadLatest()} disabled={!taskId || loading} className="rounded border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-60">{loading ? '刷新中...' : '刷新阶段结果'}</button>
        <button type="button" onClick={() => void handleExportDocx()} disabled={!taskId || exporting || !session} className="rounded border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-60">{exporting ? '导出中...' : '导出 Word'}</button>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">参考文献</p>
            <p className="text-xs text-slate-500">
              可设置数量/年限/侧重点生成；正文中用 [1]、[2] 引用，导出 Word 会以角标显示，并附参考文献列表。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleGenerateReferences()}
              disabled={!taskId || referencesGenerating}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
            >
              {referencesGenerating ? '生成中...' : '生成参考文献'}
            </button>
            <button
              type="button"
              onClick={() => void loadReferences()}
              disabled={!taskId || referencesLoading}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-60"
            >
              {referencesLoading ? '刷新中...' : '刷新列表'}
            </button>
            <button
              type="button"
              onClick={() => void handleSyncReferences()}
              disabled={!taskId}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-60"
            >
              同步正文引用
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="block text-sm text-slate-700">
            数量（5-50）
            <input
              type="number"
              min={5}
              max={50}
              value={refCount}
              onChange={(e) => setRefCount(Number(e.target.value || 0))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-slate-700">
            近年年限（1-10）
            <input
              type="number"
              min={1}
              max={10}
              value={refRecentYears}
              onChange={(e) => setRefRecentYears(Number(e.target.value || 0))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-slate-700 md:col-span-3">
            侧重点/要求（可选）
            <textarea
              value={refFocus}
              onChange={(e) => setRefFocus(e.target.value)}
              className="mt-1 h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="例如：偏重近5年平台金融/中小企业信用评估/风控模型；优先核心期刊；尽量包含国内外对比…"
            />
          </label>
        </div>

        <div className="mt-3 max-h-64 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
          {references.length ? (
            <ol className="list-decimal space-y-1 pl-5">
              {references.map((t, i) => (
                <li key={`${i}-${t.slice(0, 16)}`} className="whitespace-pre-wrap">{t}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-600">暂无参考文献。可点击“生成参考文献”。</p>
          )}
        </div>
      </div>

      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
      {toast ? <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{toast}</p> : null}
      {!error && !session && !loading ? <p className="text-sm text-slate-600">暂无正文会话，点击“开始生成正文”发起任务。</p> : null}

      {session ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            会话：{session.id}｜后端状态：{session.status}
            {session.errorMessage ? `｜错误：${session.errorMessage}` : null}
          </p>
          {sortedSections.length ? (
            <ul className="space-y-2">
              {sortedSections.map((section) => (
                <li key={section.id} className="rounded border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{section.orderIndex + 1}. {section.title}</p>
                      <p className="text-xs text-slate-500">
                        阶段状态：{section.status}
                        {typeof section.wordCount === 'number' ? `｜字数：${section.wordCount}` : null}
                        {typeof section.retryCount === 'number' ? `｜重试次数：${section.retryCount}` : null}
                        {(() => {
                          const cited = citedIndexMap.get(section.id) ?? [];
                          return cited.length ? `｜引用：${cited.map((n) => `[${n}]`).join('')}` : '';
                        })()}
                      </p>
                      <div className="mt-2 w-full max-w-md space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>本章进度</span>
                          <span>{Math.min(100, Math.max(0, Math.round(sectionProgress[section.id] ?? (section.status === 'COMPLETED' ? 100 : 0))))}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded bg-slate-100">
                          <div
                            className={
                              section.status === 'FAILED' || section.errorMessage
                                ? 'h-1.5 rounded bg-red-500'
                                : section.status === 'COMPLETED'
                                  ? 'h-1.5 rounded bg-emerald-500'
                                  : 'h-1.5 rounded bg-sky-500'
                            }
                            style={{
                              width: `${Math.min(100, Math.max(0, sectionProgress[section.id] ?? (section.status === 'COMPLETED' ? 100 : 0)))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openViewDialog(section)}
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700"
                      >
                        查看全文
                      </button>
                      <button
                        type="button"
                        onClick={() => openReviseDialog(section)}
                        disabled={!session || retryingSectionId !== null}
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 disabled:opacity-60"
                      >
                        {retryingSectionId === section.id ? '改写中...' : '导师意见改写'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditDialog(section)}
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700"
                      >
                        手动修改
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopySection(section)}
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700"
                      >
                        复制本节
                      </button>
                    </div>
                  </div>
                  {section.errorMessage ? (
                    <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                      {section.errorMessage}
                    </p>
                  ) : null}
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-slate-700">
                    {section.editedContent ||
                      section.rawContent ||
                      (section.status === 'FAILED'
                        ? '本节失败，可点击重试。'
                        : section.status === 'PENDING'
                          ? '等待生成...'
                          : section.status === 'GENERATING'
                            ? '生成中...'
                            : '内容生成中...')}
                  </p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-600">当前会话暂无章节内容。</p>}
        </div>
      ) : null}

      {dialogOpen && activeSection ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-4 shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  {activeSection.orderIndex + 1}. {activeSection.title}
                </p>
                <p className="text-xs text-slate-500">模式：{dialogMode === 'view' ? '查看' : dialogMode === 'revise' ? '导师意见改写' : '手动修改'}</p>
                {(() => {
                  const cited = citedIndexMap.get(activeSection.id) ?? [];
                  return cited.length ? (
                    <p className="mt-1 text-xs text-slate-500">本节引用：{cited.map((n) => `[${n}]`).join('')}</p>
                  ) : null;
                })()}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopySection(activeSection)}
                  className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700"
                >
                  复制本节
                </button>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700"
                >
                  关闭
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-3">
              <div className="max-h-[50vh] overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                <pre className="whitespace-pre-wrap font-sans">
                  {activeSection.editedContent || activeSection.rawContent || ''}
                </pre>
              </div>

              {dialogMode === 'revise' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">导师意见（用于改写）</label>
                  <textarea
                    value={advisorFeedback}
                    onChange={(e) => setAdvisorFeedback(e.target.value)}
                    className="h-28 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="例如：请补充数据来源与论证逻辑；加强对比分析；语言更学术；增加图表描述……"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSubmitAdvisorFeedback(activeSection, advisorFeedback)}
                      disabled={!session || dialogSubmitting || retryingSectionId !== null}
                      className="rounded bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                    >
                      {dialogSubmitting ? '处理中...' : '按导师意见改写'}
                    </button>
                  </div>
                </div>
              ) : null}

              {dialogMode === 'edit' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">手动修改内容（将覆盖本节最终内容）</label>
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="h-48 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="在这里直接编辑正文内容…"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveEditedContent(activeSection, editedText)}
                      disabled={dialogSubmitting}
                      className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
                    >
                      {dialogSubmitting ? '保存中...' : '保存修改'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
