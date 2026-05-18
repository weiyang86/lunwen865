'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientAuth } from '@/lib/client/auth';
import { getApiErrorMessage } from '@/lib/client/api-error';

type OutlineNode = {
  id: string;
  outlineId: string;
  parentId: string | null;
  nodeType: string;
  depth: number;
  orderIndex: number;
  path: string;
  title: string;
  summary: string | null;
  expectedWords: number;
  isLeaf: boolean;
  numbering: string | null;
  children: OutlineNode[];
};

type OutlineResponse = {
  id: string;
  taskId: string;
  status: string;
  locked: boolean;
  totalWordCount: number;
  targetWordCount: number;
  maxDepth: number;
  nodes: OutlineNode[];
};

const API_BASE = `${(process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '')}/api`;

function buildAuthHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const token = clientAuth.getToken();
  const normalized = token ? token.trim().replace(/\s+/g, '') : '';
  if (normalized) headers.Authorization = `Bearer ${normalized}`;
  return headers;
}

type EditState = {
  title: string;
  summary: string;
  expectedWords: string;
};

function toEditState(node: OutlineNode): EditState {
  return {
    title: node.title ?? '',
    summary: node.summary ?? '',
    expectedWords: String(node.expectedWords ?? 0),
  };
}

export function ClientOutlineWorkbench({
  taskId,
  taskTitle,
  wordCountTarget,
  onWordCountTargetSaved,
  onLocked,
}: {
  taskId?: string;
  taskTitle?: string | null;
  wordCountTarget?: number | null;
  onWordCountTargetSaved?: (next: number) => void;
  onLocked?: () => void;
}) {
  const [outline, setOutline] = useState<OutlineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locking, setLocking] = useState(false);
  const [savingWordCountTarget, setSavingWordCountTarget] = useState(false);

  const [additionalRequirements, setAdditionalRequirements] = useState('');
  const [maxDepth, setMaxDepth] = useState(3);
  const [taskWordCountTarget, setTaskWordCountTarget] = useState(
    wordCountTarget ? String(wordCountTarget) : '',
  );

  const [editMap, setEditMap] = useState<Record<string, EditState>>({});

  const title = useMemo(() => (taskTitle ?? '').trim() || '论文大纲', [taskTitle]);

  useEffect(() => {
    if (typeof wordCountTarget === 'number' && Number.isFinite(wordCountTarget)) {
      setTaskWordCountTarget(String(wordCountTarget));
    }
    if (wordCountTarget == null) {
      setTaskWordCountTarget('');
    }
  }, [wordCountTarget]);

  const hydrateEditMap = useCallback((next: OutlineResponse) => {
    const map: Record<string, EditState> = {};
    const walk = (node: OutlineNode) => {
      map[node.id] = toEditState(node);
      node.children?.forEach(walk);
    };
    next.nodes?.forEach(walk);
    setEditMap(map);
  }, []);

  const loadOutline = useCallback(async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/tasks/${taskId}/outline`, {
        headers: buildAuthHeaders(),
      });
      if (res.status === 404) {
        setOutline(null);
        setEditMap({});
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
      const data = (await res.json()) as OutlineResponse;
      setOutline(data);
      hydrateEditMap(data);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '加载大纲失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }, [hydrateEditMap, taskId]);

  useEffect(() => {
    void loadOutline();
  }, [loadOutline]);

  const handleGenerate = async () => {
    if (!taskId || submitting) return;
    const wcRaw = taskWordCountTarget.trim();
    const wcValue = Number(wcRaw);
    if (!Number.isFinite(wcValue) || wcValue < 3000 || wcValue > 100000) {
      setError('请先填写并保存任务目标字数（3000-100000），再生成目录/大纲。');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch(`${API_BASE}/tasks/${taskId}/outline/generate`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          additionalRequirements: additionalRequirements.trim()
            ? additionalRequirements.trim().slice(0, 2000)
            : undefined,
          maxDepth,
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
      const data = (await res.json()) as OutlineResponse;
      setOutline(data);
      hydrateEditMap(data);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '生成大纲失败，请稍后重试。'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLock = async () => {
    if (!taskId || !outline || locking) return;
    try {
      setLocking(true);
      setError(null);
      const res = await fetch(`${API_BASE}/tasks/${taskId}/outline/lock`, {
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
      await loadOutline();
      onLocked?.();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '锁定大纲失败，请稍后重试。'));
    } finally {
      setLocking(false);
    }
  };

  const handleSaveWordCountTarget = async () => {
    if (!taskId || savingWordCountTarget) return;
    const raw = taskWordCountTarget.trim();
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 3000 || value > 100000) {
      setError('请填写目标字数（3000-100000）。');
      return;
    }

    try {
      setSavingWordCountTarget(true);
      setError(null);
      const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ wordCountTarget: Math.floor(value) }),
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
      const updated = (await res.json().catch(() => null)) as
        | { totalWordCount?: unknown }
        | null;
      const next =
        updated && typeof updated.totalWordCount === 'number'
          ? updated.totalWordCount
          : Math.floor(value);
      onWordCountTargetSaved?.(next);
      setToast('已保存目标字数');
      window.setTimeout(() => setToast(null), 1500);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '保存目标字数失败，请稍后重试。'));
    } finally {
      setSavingWordCountTarget(false);
    }
  };

  const updateEditField = (nodeId: string, patch: Partial<EditState>) => {
    setEditMap((prev) => ({
      ...prev,
      [nodeId]: { ...(prev[nodeId] ?? { title: '', summary: '', expectedWords: '0' }), ...patch },
    }));
  };

  const handleSaveNode = async (node: OutlineNode) => {
    if (!taskId || !outline) return;
    const edit = editMap[node.id] ?? toEditState(node);
    const expectedWords = Number(edit.expectedWords);
    const body: Record<string, unknown> = {
      title: edit.title.trim() || undefined,
      summary: edit.summary.trim() || undefined,
    };
    if (node.isLeaf && Number.isFinite(expectedWords) && expectedWords >= 0) {
      body.expectedWords = Math.floor(expectedWords);
    }

    try {
      setError(null);
      const res = await fetch(`${API_BASE}/tasks/${taskId}/outline/nodes/${node.id}`, {
        method: 'PATCH',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
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
      await loadOutline();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '保存节点失败，请稍后重试。'));
    }
  };

  const handleMoveNode = async (nodeId: string, newOrderIndex: number) => {
    if (!taskId || !outline) return;
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/tasks/${taskId}/outline/nodes/${nodeId}/move`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ newOrderIndex }),
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
      await loadOutline();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '移动节点失败，请稍后重试。'));
    }
  };

  const renderNode = (node: OutlineNode, siblings: OutlineNode[]) => {
    const edit = editMap[node.id] ?? toEditState(node);
    const idx = siblings.findIndex((s) => s.id === node.id);
    const canUp = idx > 0;
    const canDown = idx >= 0 && idx < siblings.length - 1;
    const indent = Math.min(node.depth, 6) * 12;

    return (
      <li key={node.id} className="rounded border border-slate-200 bg-white p-3" style={{ marginLeft: indent }}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-[200px] flex-1">
            <div className="text-xs text-slate-500">
              {node.numbering ? `${node.numbering} ｜ ` : null}
              depth={node.depth} ｜ order={node.orderIndex}
              {node.isLeaf ? ` ｜ 目标字数=${node.expectedWords}` : null}
              {outline?.locked ? ' ｜ 已锁定' : null}
            </div>
            <input
              value={edit.title}
              onChange={(e) => updateEditField(node.id, { title: e.target.value })}
              disabled={outline?.locked}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSaveNode(node)}
              disabled={outline?.locked}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => void handleMoveNode(node.id, node.orderIndex - 1)}
              disabled={outline?.locked || !canUp}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
            >
              上移
            </button>
            <button
              type="button"
              onClick={() => void handleMoveNode(node.id, node.orderIndex + 1)}
              disabled={outline?.locked || !canDown}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
            >
              下移
            </button>
          </div>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <label className="space-y-1">
            <div className="text-xs text-slate-600">本节观点/资料/图表说明（会参与正文生成）</div>
            <textarea
              value={edit.summary}
              onChange={(e) => updateEditField(node.id, { summary: e.target.value })}
              disabled={outline?.locked}
              className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </label>
          <label className="space-y-1">
            <div className="text-xs text-slate-600">目标字数（仅叶子节点生效）</div>
            <input
              value={edit.expectedWords}
              onChange={(e) => updateEditField(node.id, { expectedWords: e.target.value })}
              disabled={outline?.locked || !node.isLeaf}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
            <div className="text-xs text-slate-500">
              叶子节点代表最终正文生成的小节；非叶子节点不生成正文。
            </div>
          </label>
        </div>
        {node.children?.length ? (
          <ul className="mt-3 space-y-2">
            {node.children
              .slice()
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((child) => renderNode(child, node.children))}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <header>
        <h2 className="text-xl font-semibold">目录/大纲（可调整）</h2>
        <p className="text-sm text-slate-600">题目：{title}</p>
        <p className="text-xs text-slate-500">
          先生成目录/大纲 → 调整章节标题/顺序/每节观点资料 → 锁定后才能进入正文分节生成。
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 md:col-span-2">
            <div className="text-xs text-slate-600">目录要求/章节要求/材料补充（可选）</div>
            <textarea
              value={additionalRequirements}
              onChange={(e) => setAdditionalRequirements(e.target.value)}
              className="min-h-16 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="例如：必须包含“研究现状/技术路线/数据来源/图表清单”；某章需要引用你提供的材料..."
            />
          </label>
          <label className="space-y-1">
            <div className="text-xs text-slate-600">目录层级（2-5）</div>
            <select
              value={String(maxDepth)}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </label>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <label className="space-y-1">
            <div className="text-xs text-slate-600">任务目标字数（必填，用于分配各章字数）</div>
            <input
              value={taskWordCountTarget}
              onChange={(e) => setTaskWordCountTarget(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="例如：8000"
              inputMode="numeric"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void handleSaveWordCountTarget()}
              disabled={!taskId || savingWordCountTarget}
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:opacity-60"
            >
              {savingWordCountTarget ? '保存中...' : '保存目标字数'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={!taskId || submitting || outline?.locked}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {submitting ? '生成中...' : outline ? '重新生成目录/大纲' : '生成目录/大纲'}
        </button>
        <button
          type="button"
          onClick={() => void loadOutline()}
          disabled={!taskId || loading}
          className="rounded border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-60"
        >
          {loading ? '刷新中...' : '刷新结果'}
        </button>
        <button
          type="button"
          onClick={() => void handleLock()}
          disabled={!outline || outline.locked || locking}
          className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-60"
        >
          {locking ? '锁定中...' : outline?.locked ? '已锁定' : '锁定目录并进入正文'}
        </button>
      </div>

      {toast ? (
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{toast}</p>
      ) : null}
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}

      {!error && !outline && !loading ? (
        <p className="text-sm text-slate-600">
          暂无大纲。点击“生成目录/大纲”开始；生成后可在每节填入你的观点/材料/图表说明。
        </p>
      ) : null}

      {outline ? (
        <div className="space-y-2">
          <div className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            后端状态：{outline.status}｜是否锁定：{outline.locked ? '是' : '否'}｜目标字数：
            {outline.targetWordCount}｜大纲字数合计：{outline.totalWordCount}｜层级：{outline.maxDepth}
          </div>
          <ul className="space-y-2">
            {outline.nodes
              .slice()
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((n) => renderNode(n, outline.nodes))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
