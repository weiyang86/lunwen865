'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';

type Section = { id: string; title: string; sectionType: string; content?: string | null; wordCount: number; level: number; sortOrder: number; updatedAt: string; children?: Section[] };
type AdvisorComment = { id: string; sectionId?: string | null; commentText: string; status: string; createdAt: string; resolvedAt?: string | null };
type Revision = { id: string; sectionId?: string | null; version: number; beforeContent?: string | null; afterContent?: string | null; changeSummary?: string | null; operatorRole?: string | null; createdAt: string; section?: { id: string; title: string } | null };
type WorkbenchResp = { task: any; document: null | { id: string; title: string; status: string; currentVersion: number; wordCount: number; updatedAt: string; sections: Section[] }; advisorComments: AdvisorComment[]; canInit: boolean };

const STAGES = ['TOPIC', 'OPENING', 'OUTLINE', 'WRITING', 'REFERENCE'];
const SECTION_TYPES = ['TITLE', 'ABSTRACT', 'KEYWORDS', 'CHAPTER', 'SECTION', 'REFERENCE', 'ACKNOWLEDGEMENT', 'APPENDIX'];

function flatten(sections: Section[]): Section[] {
  return sections.flatMap((s) => [s, ...flatten(s.children ?? [])]);
}

function countText(text: string) {
  const normalized = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const cn = (normalized.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const en = normalized.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
  return cn + en;
}

function SectionTree({ sections, activeId, onSelect, onDelete }: { sections: Section[]; activeId?: string; onSelect: (s: Section) => void; onDelete: (s: Section) => void }) {
  return <div className="space-y-1">{sections.map((section) => <div key={section.id} className="space-y-1"><button type="button" onClick={() => onSelect(section)} className={`w-full rounded px-2 py-2 text-left text-sm ${activeId === section.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`} style={{ paddingLeft: 8 + (section.level - 1) * 14 }}><div className="font-medium">{section.title}</div><div className="text-xs opacity-70">{section.sectionType} · {section.wordCount} 字</div></button><div className="px-2"><button type="button" onClick={() => onDelete(section)} className="text-xs text-rose-600 hover:underline">删除</button></div>{section.children?.length ? <SectionTree sections={section.children} activeId={activeId} onSelect={onSelect} onDelete={onDelete} /> : null}</div>)}</div>;
}

export function ThesisDocumentWorkbenchPage({ taskId }: { taskId: string }) {
  const [data, setData] = useState<WorkbenchResp | null>(null);
  const [activeId, setActiveId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [sectionType, setSectionType] = useState('SECTION');
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [commentText, setCommentText] = useState('');
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeStage, setMergeStage] = useState('OUTLINE');
  const [mergeMode, setMergeMode] = useState('APPEND');

  const sections = useMemo(() => data?.document?.sections ?? [], [data?.document?.sections]);
  const flatSections = useMemo(() => flatten(sections), [sections]);
  const active = flatSections.find((s) => s.id === activeId) ?? flatSections[0] ?? null;
  const dirty = Boolean(active) && (content !== savedContent || title !== (active?.title ?? '') || sectionType !== (active?.sectionType ?? 'SECTION'));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await clientHttp.get<WorkbenchResp>(`/thesis-tasks/${taskId}/document`);
      setData(next);
      const first = flatten(next.document?.sections ?? [])[0];
      if (!activeId && first) setActiveId(first.id);
    } catch (e) {
      setError(getApiErrorMessage(e, '加载论文文档失败'));
    } finally {
      setLoading(false);
    }
  }, [taskId, activeId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!active) return;
    setTitle(active.title);
    setSectionType(active.sectionType);
    setContent(active.content ?? '');
    setSavedContent(active.content ?? '');
  }, [active]);

  useEffect(() => {
    if (!data?.document) return;
    void clientHttp.get<{ list: Revision[] }>(`/thesis-documents/${data.document.id}/revisions`, { pageSize: 20 }).then((r) => setRevisions(r.list ?? [])).catch(() => setRevisions([]));
  }, [data?.document, saving]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  async function initDocument() {
    setSaving(true);
    try { await clientHttp.post(`/thesis-tasks/${taskId}/document/init`, {}); setMessage('论文文档已初始化'); await load(); }
    catch (e) { setError(getApiErrorMessage(e, '初始化失败')); }
    finally { setSaving(false); }
  }

  async function addSection() {
    if (!data?.document) return;
    const sortOrder = active ? active.sortOrder + 1 : flatSections.length * 10 + 10;
    const created = await clientHttp.post<Section>(`/thesis-documents/${data.document.id}/sections`, { title: '新章节', sectionType: 'SECTION', sortOrder, level: active?.level ?? 1 });
    setActiveId(created.id);
    setMessage('章节已新增');
    await load();
  }

  async function saveSection() {
    if (!active) return;
    setSaving(true);
    try {
      await clientHttp.patch(`/thesis-document-sections/${active.id}`, { title, sectionType, content });
      setSavedContent(content);
      setMessage('已保存章节并记录版本（内容变化时）');
      await load();
    } catch (e) { setError(getApiErrorMessage(e, '保存失败')); }
    finally { setSaving(false); }
  }

  async function deleteSection(section: Section) {
    if (!window.confirm(`确认删除「${section.title}」？有子章节时将一并删除。`)) return;
    await clientHttp.delete(`/thesis-document-sections/${section.id}`);
    setMessage('章节已删除');
    setActiveId('');
    await load();
  }

  async function doMergeStage() {
    if (!data?.document) return;
    setSaving(true);
    try {
      await clientHttp.post(`/thesis-documents/${data.document.id}/merge-stage-content`, { stage: mergeStage, mode: mergeMode, sectionId: mergeMode === 'REPLACE_SECTION' ? active?.id : undefined });
      setMessage('阶段内容已合并到论文文档');
      setMergeOpen(false);
      await load();
    } catch (e) { setError(getApiErrorMessage(e, '合稿失败：当前阶段可能尚无可合并内容')); }
    finally { setSaving(false); }
  }

  async function addComment() {
    if (!data?.document || !commentText.trim()) return;
    await clientHttp.post(`/thesis-documents/${data.document.id}/advisor-comments`, { sectionId: active?.id, commentText });
    setCommentText('');
    setMessage('导师修改要求已记录');
    await load();
  }

  async function updateComment(id: string, status: string) {
    await clientHttp.patch(`/thesis-advisor-comments/${id}`, { status });
    await load();
  }

  if (loading && !data) return <div className="p-6 text-sm text-slate-600">加载论文工作台...</div>;

  return <div className="min-h-screen bg-slate-50 p-4 text-slate-900 lg:p-6">
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">论文文档工作台</h1>
          <p className="mt-1 text-sm text-slate-600">AI 生成与编辑内容仅作为学习和写作辅助，请根据学校规范、导师要求和真实资料自行核验后使用。</p>
          <p className="mt-2 text-sm text-slate-500">{data?.task?.title ?? '未命名任务'} · {data?.task?.schoolName ?? '未绑定学校'} / {data?.task?.majorName ?? '未绑定专业'} / {data?.task?.educationLevel ?? '未指定学历'} / {data?.task?.thesisType ?? '未指定类型'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60" disabled={saving || !data?.canInit} onClick={() => void initDocument()}>{data?.document ? '已初始化' : '初始化论文文档'}</button>
          <button className="rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60" disabled={!data?.document} onClick={() => setMergeOpen(true)}>合并阶段内容</button>
          <Link href={`/downloads?taskId=${encodeURIComponent(taskId)}`} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">导出 / 下载</Link>
        </div>
      </div>
      {message ? <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
    </div>

    {!data?.document ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><div className="text-lg font-medium">当前任务尚未初始化论文文档</div><p className="mt-2 text-sm text-slate-600">初始化后将生成默认目录，支持在线编辑、版本记录和导师意见管理。</p><button className="mt-4 rounded bg-slate-900 px-4 py-2 text-white" onClick={() => void initDocument()}>初始化论文文档</button></div> : <div className="grid gap-4 lg:grid-cols-[280px_1fr_320px]">
      <aside className="rounded-xl border border-slate-200 bg-white p-3"><div className="mb-3 flex items-center justify-between"><h2 className="font-medium">论文目录</h2><button className="text-sm text-indigo-600" onClick={() => void addSection()}>新增</button></div><SectionTree sections={sections} activeId={active?.id} onSelect={(s) => setActiveId(s.id)} onDelete={(s) => void deleteSection(s)} /></aside>
      <main className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-medium">章节编辑</h2><p className="text-xs text-slate-500">文档总字数：{data.document.wordCount} · 当前版本：v{data.document.currentVersion} · {dirty ? '有未保存修改' : '已同步'}</p></div><button className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60" disabled={!active || saving} onClick={() => void saveSection()}>{saving ? '保存中...' : '保存章节'}</button></div>{active ? <div className="space-y-3"><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" /><select value={sectionType} onChange={(e) => setSectionType(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2">{SECTION_TYPES.map((x) => <option key={x}>{x}</option>)}</select><textarea value={content} onChange={(e) => setContent(e.target.value)} rows={22} className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm" placeholder="在此编辑章节正文，首期支持 Markdown / 纯文本。" /><div className="text-sm text-slate-500">当前编辑区字数：{countText(content)} · 最近保存：{new Date(active.updatedAt).toLocaleString()}</div></div> : <div className="py-20 text-center text-sm text-slate-500">请选择或新增章节</div>}</main>
      <aside className="space-y-4"><div className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-medium">导师修改要求</h2><textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={3} className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="记录导师线下反馈或修改要求" /><button className="mt-2 rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => void addComment()}>新增意见</button><div className="mt-3 space-y-2">{data.advisorComments.map((c) => <div key={c.id} className="rounded border border-slate-200 p-2 text-sm"><div>{c.commentText}</div><div className="mt-1 text-xs text-slate-500">{c.status} · {new Date(c.createdAt).toLocaleString()}</div><div className="mt-2 flex gap-2"><button className="text-xs text-emerald-700" onClick={() => void updateComment(c.id, 'RESOLVED')}>已解决</button><button className="text-xs text-slate-600" onClick={() => void updateComment(c.id, 'IGNORED')}>忽略</button></div></div>)}</div></div><div className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-medium">修改记录</h2><div className="mt-3 max-h-72 space-y-2 overflow-auto">{revisions.length ? revisions.map((r) => <details key={r.id} className="rounded border border-slate-200 p-2 text-sm"><summary>{r.section?.title ?? '文档'} · v{r.version} · {r.changeSummary ?? '内容修改'}</summary><pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">修改前：\n{r.beforeContent ?? ''}\n\n修改后：\n{r.afterContent ?? ''}</pre></details>) : <div className="text-sm text-slate-500">暂无修改记录</div>}</div></div><div className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-medium">AI 操作台</h2><p className="mt-2 text-sm text-slate-500">优化本段、按导师意见修改、检查逻辑、检查格式、生成摘要、生成关键词等能力将在后续 Skill 接入中增强。</p></div></aside>
    </div>}

    {mergeOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"><h2 className="text-lg font-semibold">合并阶段内容</h2><label className="mt-4 block text-sm">阶段<select value={mergeStage} onChange={(e) => setMergeStage(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2">{STAGES.map((x) => <option key={x}>{x}</option>)}</select></label><label className="mt-3 block text-sm">方式<select value={mergeMode} onChange={(e) => setMergeMode(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2"><option value="APPEND">追加到文档</option><option value="REPLACE_SECTION">替换当前章节</option><option value="SMART_MERGE">简单智能合并（首期按追加处理）</option></select></label><div className="mt-5 flex justify-end gap-2"><button className="rounded border border-slate-300 px-3 py-2" onClick={() => setMergeOpen(false)}>取消</button><button className="rounded bg-slate-900 px-3 py-2 text-white" onClick={() => void doMergeStage()}>确认合并</button></div></div></div> : null}
  </div>;
}
