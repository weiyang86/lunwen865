'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

type TopicCandidateRevision = {
  id: string;
  candidateId: string;
  type: 'AI_GENERATED' | 'CUSTOM_SELECT' | 'ADVISOR_EDIT' | 'MANUAL_EDIT';
  note: string | null;
  beforeTitle: string | null;
  afterTitle: string;
  createdAt: string;
};

type GeneratePayload = {
  count: number;
  additionalContext?: string;
  preferredStyle?: string;
};

type RegeneratePayload = {
  count: number;
  feedback?: string;
  rejectedTitles?: string[];
  preferredStyle?: string;
};

type TopicCandidateGroup = { batch: number; items: TopicCandidate[] };

export function ClientTopicWorkbench({
  taskId,
  onTopicConfirmed,
  onSelectionChange,
}: {
  taskId?: string;
  onTopicConfirmed?: (candidate: TopicCandidate) => void;
  onSelectionChange?: (selected: boolean) => void;
}) {
  const preferredStyleOptions = useMemo(
    () => [
      '实证研究',
      '案例分析',
      '文献综述',
      '理论研究',
      '对比研究',
      '政策分析',
      '问卷调查',
      '计量经济',
      '定性访谈',
      '混合研究',
    ],
    [],
  );

  const [count, setCount] = useState(5);
  const [topicDirection, setTopicDirection] = useState('');
  const [mentorNotes, setMentorNotes] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [preferredStyleSelected, setPreferredStyleSelected] = useState<string[]>([]);
  const [preferredStyleCustom, setPreferredStyleCustom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [unselecting, setUnselecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TopicCandidate[]>([]);
  const [viewMode, setViewMode] = useState<'latest' | 'all'>('latest');
  const [progress, setProgress] = useState<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);

  const [customTitle, setCustomTitle] = useState('');
  const [customType, setCustomType] = useState<'MENTOR' | 'SELF'>('SELF');
  const [customNote, setCustomNote] = useState('');
  const [customSubmitting, setCustomSubmitting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<TopicCandidate | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<'MENTOR' | 'SELF'>('SELF');
  const [editNote, setEditNote] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [revisions, setRevisions] = useState<TopicCandidateRevision[] | null>(null);

  const preferredStyleText = useMemo(() => {
    const parts = [...preferredStyleSelected];
    const custom = preferredStyleCustom.trim();
    if (custom) parts.push(custom);
    return parts.join('、');
  }, [preferredStyleCustom, preferredStyleSelected]);

  const emptyReason = useMemo(() => {
    if (!taskId) return '请先提供 taskId（例如：/tasks?taskId=xxx）';
    if (!items.length) return '当前任务还没有题目候选，先提交一次生成。';
    return null;
  }, [items.length, taskId]);

  const loadCandidates = useCallback(async (mode: 'latest' | 'all') => {
    if (!taskId) return;
    try {
      setLoading(true);
      setError(null);
      const path = mode === 'all' ? `/tasks/${taskId}/topics` : `/tasks/${taskId}/topics/latest`;
      const data = await clientHttp.get<TopicCandidate[]>(path);
      setItems(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '加载题目候选失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const stopProgressTimer = useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    stopProgressTimer();
    setProgress(0);
    progressTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev === null) return 0;
        if (prev >= 95) return prev;
        return Math.min(95, prev + 1);
      });
    }, 200);
  }, [stopProgressTimer]);

  const finishProgress = useCallback(() => {
    stopProgressTimer();
    setProgress(100);
    window.setTimeout(() => setProgress(null), 1200);
  }, [stopProgressTimer]);

  useEffect(() => {
    void loadCandidates(viewMode);
  }, [loadCandidates, viewMode]);

  useEffect(() => {
    return () => {
      stopProgressTimer();
    };
  }, [stopProgressTimer]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || !taskId) return;
    if (count < 1 || count > 10) {
      setError('候选数量必须在 1 到 10 之间');
      return;
    }

    const payload: GeneratePayload = { count };
    const mergedContext = [
      topicDirection.trim() ? `题目方向/研究对象：${topicDirection.trim()}` : null,
      mentorNotes.trim() ? `导师要求/约束：${mentorNotes.trim()}` : null,
      additionalContext.trim() ? `补充说明：${additionalContext.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    if (mergedContext) payload.additionalContext = mergedContext;
    if (preferredStyleText) payload.preferredStyle = preferredStyleText;

    try {
      setSubmitting(true);
      setError(null);
      startProgress();
      await clientHttp.post(`/tasks/${taskId}/topics/generate`, payload);
      setViewMode('latest');
      await loadCandidates('latest');
      finishProgress();
    } catch (err: unknown) {
      stopProgressTimer();
      setProgress(null);
      setError(getApiErrorMessage(err, '生成失败，请检查任务状态或稍后重试。'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerate = async () => {
    if (regenerating || !taskId) return;
    const payload: RegeneratePayload = { count };
    const mergedFeedback = [
      topicDirection.trim() ? `题目方向/研究对象：${topicDirection.trim()}` : null,
      mentorNotes.trim() ? `导师要求/约束：${mentorNotes.trim()}` : null,
      additionalContext.trim() ? `重试反馈：${additionalContext.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    if (mergedFeedback) payload.feedback = mergedFeedback;
    if (preferredStyleText) payload.preferredStyle = preferredStyleText;
    if (items.length) {
      const latestBatch = Math.max(...items.map((x) => x.generationBatch));
      const rejectedTitles = items
        .filter((x) => x.generationBatch === latestBatch)
        .map((x) => x.title)
        .filter(Boolean);
      if (rejectedTitles.length) payload.rejectedTitles = rejectedTitles;
    }

    try {
      setRegenerating(true);
      setError(null);
      startProgress();
      await clientHttp.post(`/tasks/${taskId}/topics/regenerate`, payload);
      setViewMode('latest');
      await loadCandidates('latest');
      finishProgress();
    } catch (err: unknown) {
      stopProgressTimer();
      setProgress(null);
      setError(getApiErrorMessage(err, '重试生成失败，请稍后重试。'));
    } finally {
      setRegenerating(false);
    }
  };

  const selectedCandidate = useMemo(() => {
    return items.find((x) => x.isSelected) ?? null;
  }, [items]);

  useEffect(() => {
    onSelectionChange?.(Boolean(selectedCandidate));
  }, [onSelectionChange, selectedCandidate]);

  const grouped = useMemo((): TopicCandidateGroup[] => {
    if (viewMode !== 'all') return [];
    const map = new Map<number, TopicCandidate[]>();
    for (const item of items) {
      const batch = item.generationBatch ?? 0;
      const arr = map.get(batch) ?? [];
      arr.push(item);
      map.set(batch, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([batch, list]) => ({ batch, items: list }));
  }, [items, viewMode]);

  const handleSelect = async (candidate: TopicCandidate) => {
    if (!taskId) return;
    if (selectingId) return;
    if (candidate.isSelected) return;

    const ok = window.confirm(
      `确认选定该题目吗？\n\n${candidate.title}\n\n确认后将进入开题报告生成阶段。`,
    );
    if (!ok) return;

    try {
      setSelectingId(candidate.id);
      setError(null);
      const updated = await clientHttp.post<TopicCandidate>(
        `/tasks/${taskId}/topics/${candidate.id}/select`,
      );
      await loadCandidates(viewMode);
      onTopicConfirmed?.(updated);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '选定题目失败，请稍后重试。'));
    } finally {
      setSelectingId(null);
    }
  };

  const handleCustomSelect = async () => {
    if (!taskId) return;
    if (customSubmitting) return;
    const title = customTitle.trim();
    if (!title) {
      setError('请填写你确定的题目');
      return;
    }

    const ok = window.confirm(`确认选定该题目吗？\n\n${title}\n\n确认后将进入下一阶段。`);
    if (!ok) return;

    try {
      setCustomSubmitting(true);
      setError(null);
      const updated = await clientHttp.post<TopicCandidate>(
        `/tasks/${taskId}/topics/custom-select`,
        {
          title,
          type: customType,
          note: customNote.trim() ? customNote.trim() : undefined,
        },
      );
      setViewMode('latest');
      await loadCandidates('latest');
      onTopicConfirmed?.(updated);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '自定义选定题目失败，请稍后重试。'));
    } finally {
      setCustomSubmitting(false);
    }
  };

  const openEdit = (candidate: TopicCandidate) => {
    setEditing(candidate);
    setEditTitle(candidate.title);
    setEditType('SELF');
    setEditNote('');
    setRevisions(null);
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditing(null);
    setRevisions(null);
  };

  const handleSaveEdit = async () => {
    if (!taskId || !editing) return;
    if (editSubmitting) return;
    const title = editTitle.trim();
    if (!title) {
      setError('题目不能为空');
      return;
    }

    try {
      setEditSubmitting(true);
      setError(null);
      await clientHttp.patch<TopicCandidate>(
        `/tasks/${taskId}/topics/${editing.id}`,
        {
          title,
          type: editType,
          note: editNote.trim() ? editNote.trim() : undefined,
        },
      );
      await loadCandidates(viewMode);
      closeEdit();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '更改题目失败，请稍后重试。'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const loadRevisions = async () => {
    if (!taskId || !editing) return;
    if (revisionLoading) return;
    try {
      setRevisionLoading(true);
      const data = await clientHttp.get<TopicCandidateRevision[]>(
        `/tasks/${taskId}/topics/${editing.id}/revisions`,
      );
      setRevisions(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '加载版本历史失败，请稍后重试。'));
    } finally {
      setRevisionLoading(false);
    }
  };

  const handleUnselect = async () => {
    if (!taskId) return;
    if (unselecting) return;
    const ok = window.confirm('确认取消选定题目吗？');
    if (!ok) return;

    try {
      setUnselecting(true);
      setError(null);
      await clientHttp.post(`/tasks/${taskId}/topics/unselect`);
      await loadCandidates(viewMode);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '取消选定失败，请稍后重试。'));
    } finally {
      setUnselecting(false);
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">论文题目生成</h1>
        <p className="text-sm text-slate-600">提交生成请求并查看最新候选，支持切换查看历史。</p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-medium">题目已确定？选定我自己的题目</h2>
            <p className="mt-1 text-sm text-slate-600">
              适用于你已经在导师处通过题目的情况，可直接输入最终题目并选定。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleCustomSelect()}
            disabled={!taskId || customSubmitting || submitting || regenerating || selectingId !== null}
            className="rounded bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {customSubmitting ? '选定中...' : '选定该题目'}
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            我的最终题目
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="请输入你确定的论文题目"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              disabled={!taskId || customSubmitting}
            />
          </label>
          <label className="text-sm">
            更改来源
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value === 'MENTOR' ? 'MENTOR' : 'SELF')}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              disabled={!taskId || customSubmitting}
            >
              <option value="SELF">自行确定</option>
              <option value="MENTOR">导师已通过/意见</option>
            </select>
          </label>
          <label className="text-sm">
            备注（选填）
            <input
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="如：导师要求更聚焦某地区/某模型"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              disabled={!taskId || customSubmitting}
            />
          </label>
        </div>
      </div>

      {selectedCandidate ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">已选定题目</p>
              <p className="mt-1">{selectedCandidate.title}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleUnselect()}
              disabled={unselecting || submitting || regenerating || selectingId !== null}
              className="rounded border border-emerald-300 bg-white px-3 py-1 text-xs text-emerald-800 disabled:opacity-60"
            >
              {unselecting ? '处理中...' : '取消选定'}
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <label className="text-sm">候选数量（1~10）
          <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting || regenerating || !taskId} />
        </label>
        <div className="text-sm">
          <div className="flex items-center justify-between">
            <div>偏好风格（可多选）</div>
            <button
              type="button"
              onClick={() => {
                setPreferredStyleSelected([]);
                setPreferredStyleCustom('');
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
              disabled={submitting || regenerating || !taskId}
            >
              清空
            </button>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {preferredStyleOptions.map((opt) => {
              const checked = preferredStyleSelected.includes(opt);
              return (
                <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...preferredStyleSelected, opt]
                        : preferredStyleSelected.filter((x) => x !== opt);
                      setPreferredStyleSelected(next);
                    }}
                    disabled={submitting || regenerating || !taskId}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
          <input
            value={preferredStyleCustom}
            onChange={(e) => setPreferredStyleCustom(e.target.value)}
            placeholder="也可补充自定义（选填）"
            className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
            disabled={submitting || regenerating || !taskId}
          />
        </div>
        <label className="text-sm md:col-span-2">题目方向 / 研究对象（选填）
          <textarea value={topicDirection} onChange={(e) => setTopicDirection(e.target.value)} rows={2} placeholder="如：数字经济背景下中小企业融资效率；某行业/某地区；2022-2025 年" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting || regenerating || !taskId} />
        </label>
        <label className="text-sm md:col-span-2">导师要求 / 约束（选填）
          <textarea value={mentorNotes} onChange={(e) => setMentorNotes(e.target.value)} rows={2} placeholder="如：必须实证 + 变量口径；至少 X 篇中文核心；禁止过宽泛" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting || regenerating || !taskId} />
        </label>
        <label className="text-sm md:col-span-2">补充说明 / 重试反馈（选填）
          <textarea value={additionalContext} onChange={(e) => setAdditionalContext(e.target.value)} rows={3} placeholder="如：不想要某些关键词、需要包含某些理论/模型、希望更聚焦/更可落地" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting || regenerating || !taskId} />
        </label>
        {progress !== null ? (
          <div className="md:col-span-2 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{submitting ? '生成中' : regenerating ? '重试生成中' : '处理中'}</span>
              <span>{Math.min(100, Math.max(0, Math.round(progress)))}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
              <div
                className="h-2 rounded bg-emerald-500"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        ) : null}
        {error ? <p className="md:col-span-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        <div className="md:col-span-2 flex flex-wrap gap-2">
          <button type="submit" disabled={submitting || regenerating || !taskId} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{submitting ? '生成中...' : '生成题目'}</button>
          <button type="button" disabled={submitting || regenerating || !taskId} onClick={() => void handleRegenerate()} className="rounded border border-slate-300 bg-white px-4 py-2 text-slate-700 disabled:opacity-60">{regenerating ? '重试中...' : '重试生成一批'}</button>
        </div>
      </form>

      <div className="flex items-center gap-2 text-sm">
        <button type="button" onClick={() => setViewMode('latest')} className={`rounded px-3 py-1 ${viewMode === 'latest' ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>查看最新</button>
        <button type="button" onClick={() => setViewMode('all')} className={`rounded px-3 py-1 ${viewMode === 'all' ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>查看全部历史</button>
      </div>

      {loading ? <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">正在加载候选题目...</div> : null}
      {!loading && emptyReason ? <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">{emptyReason}</div> : null}

      {!loading && items.length > 0 && viewMode === 'latest' ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-medium">{item.title}</h2>
                <span className="text-xs text-slate-500">
                  第 {item.generationBatch} 轮{item.isSelected ? ' · 已选定' : ''}
                </span>
              </div>
              {item.rationale ? (
                <p className="mt-2 text-sm text-slate-600">理由：{item.rationale}</p>
              ) : null}
              {item.keywords?.length ? (
                <p className="mt-1 text-xs text-slate-500">关键词：{item.keywords.join(' / ')}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  disabled={submitting || regenerating || selectingId !== null}
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
                >
                  更改
                </button>
              {!item.isSelected ? (
                <button
                  type="button"
                  onClick={() => void handleSelect(item)}
                  disabled={selectingId !== null || submitting || regenerating}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  {selectingId === item.id ? '确认中...' : '选定此题目'}
                </button>
              ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && items.length > 0 && viewMode === 'all' ? (
        <div className="space-y-4">
          {grouped.map((group) => (
            <section key={group.batch} className="space-y-3">
              <div className="text-sm font-medium text-slate-700">第 {group.batch} 轮</div>
              <ul className="space-y-3">
                {group.items.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="font-medium">{item.title}</h2>
                      <span className="text-xs text-slate-500">
                        {item.isSelected ? '已选定' : '未选定'}
                      </span>
                    </div>
                    {item.rationale ? (
                      <p className="mt-2 text-sm text-slate-600">理由：{item.rationale}</p>
                    ) : null}
                    {item.keywords?.length ? (
                      <p className="mt-1 text-xs text-slate-500">关键词：{item.keywords.join(' / ')}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        disabled={submitting || regenerating || selectingId !== null}
                        className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
                      >
                        更改
                      </button>
                      {!item.isSelected ? (
                        <button
                          type="button"
                          onClick={() => void handleSelect(item)}
                          disabled={selectingId !== null || submitting || regenerating}
                          className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                        >
                          {selectingId === item.id ? '确认中...' : '选定此题目'}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      <Dialog open={editOpen} onOpenChange={(open) => (open ? null : closeEdit())}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>更改题目</DialogTitle>
            <DialogDescription>
              支持记录更改来源（导师/自行）与备注，并自动保存版本历史。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="text-sm">
              题目标题
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                disabled={editSubmitting}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                更改来源
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value === 'MENTOR' ? 'MENTOR' : 'SELF')}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  disabled={editSubmitting}
                >
                  <option value="SELF">自行更改</option>
                  <option value="MENTOR">导师意见更改</option>
                </select>
              </label>
              <label className="text-sm">
                备注（选填）
                <input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  disabled={editSubmitting}
                />
              </label>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-slate-700">版本历史</div>
                <button
                  type="button"
                  onClick={() => void loadRevisions()}
                  disabled={!editing || revisionLoading}
                  className="text-xs text-slate-600 hover:text-slate-900 disabled:opacity-60"
                >
                  {revisionLoading ? '加载中...' : revisions ? '刷新' : '查看'}
                </button>
              </div>
              {revisions?.length ? (
                <ul className="mt-2 space-y-2">
                  {revisions.map((rev) => (
                    <li key={rev.id} className="rounded border border-slate-200 bg-white p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          {rev.type === 'AI_GENERATED'
                            ? 'AI 生成'
                            : rev.type === 'CUSTOM_SELECT'
                              ? '自定义选定'
                              : rev.type === 'ADVISOR_EDIT'
                                ? '导师意见更改'
                                : '自行更改'}
                        </span>
                        <span>{new Date(rev.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{rev.afterTitle}</div>
                      {rev.note ? (
                        <div className="mt-1 text-xs text-slate-500">备注：{rev.note}</div>
                      ) : null}
                      {rev.beforeTitle ? (
                        <div className="mt-1 text-xs text-slate-500">上一版：{rev.beforeTitle}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : revisions && revisions.length === 0 ? (
                <div className="mt-2 text-xs text-slate-500">暂无历史记录</div>
              ) : (
                <div className="mt-2 text-xs text-slate-500">点击“查看”加载历史</div>
              )}
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => closeEdit()}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              disabled={editSubmitting}
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleSaveEdit()}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              disabled={editSubmitting || !editing}
            >
              {editSubmitting ? '保存中...' : '保存更改'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
