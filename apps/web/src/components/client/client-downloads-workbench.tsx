'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';

type TaskItem = { id: string; title: string | null; updatedAt: string; schoolName?: string | null; majorName?: string | null; educationLevel?: string | null; thesisType?: string | null };
type Template = { id: string; name: string; code: string; description?: string | null; school?: { name: string } | null; college?: { name: string } | null; major?: { name: string } | null; educationLevel?: string | null; thesisType?: string | null; stage?: string | null; isDefault: boolean; templateType: string };
type ExportOptions = { canExport: boolean; task: TaskItem & { schoolName?: string | null; majorName?: string | null }; document: null | { id: string; title: string; status: string; wordCount: number; updatedAt: string }; availableStages: string[]; availableFormats: string[]; matchedTemplates: Template[]; defaultTemplate: Template | null; warningMessages: string[] };
type ThesisExportJob = { id: string; exportStage: string; exportFormat: string; status: string; progress: number; fileName?: string | null; fileSize?: number | null; fileUrl?: string | null; errorMessage?: string | null; customRequirement?: string | null; createdAt: string; template?: { id: string; name: string; code: string } | null };
type LegacyExportItem = { id: string; title: string; paperId: string | null; template: string; scope: string; status: string; progress: number; fileName?: string | null; errorMessage?: string | null; createdAt: string };

function formatSize(size?: number | null) {
  if (!size) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function ClientDownloadsWorkbench() {
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [options, setOptions] = useState<ExportOptions | null>(null);
  const [stage, setStage] = useState('FULL_PAPER');
  const [format, setFormat] = useState('DOCX');
  const [templateId, setTemplateId] = useState('');
  const [customRequirement, setCustomRequirement] = useState('');
  const [jobs, setJobs] = useState<ThesisExportJob[]>([]);
  const [legacyItems, setLegacyItems] = useState<LegacyExportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const taskId = new URLSearchParams(window.location.search).get('taskId');
    if (taskId) setSelectedTaskId(taskId);
  }, []);

  const loadTasks = useCallback(async () => {
    const data = await clientHttp.get<{ items: TaskItem[] }>('/tasks', { page: 1, pageSize: 50 });
    setTasks((data.items ?? []).slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')));
  }, []);

  const loadLegacy = useCallback(async () => {
    try {
      const data = await clientHttp.get<{ items: LegacyExportItem[] }>('/export', { page: 1, pageSize: 20 });
      setLegacyItems(data.items ?? []);
    } catch {
      setLegacyItems([]);
    }
  }, []);

  const loadOptions = useCallback(async (taskId: string, nextStage = stage, nextFormat = format) => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await clientHttp.get<ExportOptions>(`/thesis-tasks/${taskId}/export-options`, { stage: nextStage, exportFormat: nextFormat });
      setOptions(data);
      setTemplateId(data.defaultTemplate?.id ?? data.matchedTemplates[0]?.id ?? '');
      const history = await clientHttp.get<{ items: ThesisExportJob[] }>(`/thesis-tasks/${taskId}/export-jobs`);
      setJobs(history.items ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, '加载导出选项失败'));
      setOptions(null);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [format, stage]);

  const refreshJobs = useCallback(async () => {
    if (!selectedTaskId || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const history = await clientHttp.get<{ items: ThesisExportJob[] }>(`/thesis-tasks/${selectedTaskId}/export-jobs`);
      setJobs(history.items ?? []);
    } catch {
      // keep current rows while polling
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [selectedTaskId]);

  useEffect(() => { void loadTasks(); void loadLegacy(); }, [loadTasks, loadLegacy]);
  useEffect(() => { if (selectedTaskId) void loadOptions(selectedTaskId); }, [selectedTaskId, loadOptions]);
  useEffect(() => {
    const hasRunning = jobs.some((j) => ['PENDING', 'RUNNING'].includes(j.status));
    if (!hasRunning) return;
    const timer = window.setInterval(() => void refreshJobs(), 1500);
    return () => window.clearInterval(timer);
  }, [jobs, refreshJobs]);

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedTaskId), [selectedTaskId, tasks]);
  const selectedTemplate = useMemo(() => options?.matchedTemplates.find((t) => t.id === templateId) ?? null, [options, templateId]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTaskId || !options?.document) { setError('请先选择已初始化论文文档的任务。'); return; }
    if (!templateId) { setError('请选择格式模板。'); return; }
    if (format === 'PDF') { setError('PDF 导出将在后续版本开放，请先使用 Word 导出。'); return; }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const job = await clientHttp.post<ThesisExportJob>(`/thesis-tasks/${selectedTaskId}/export-jobs`, { documentId: options.document.id, templateId, exportStage: stage, exportFormat: format, customRequirement });
      setSuccess(`导出任务已创建：${job.id}`);
      await refreshJobs();
    } catch (err) {
      setError(getApiErrorMessage(err, '创建导出任务失败'));
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-4">
    <header>
      <h1 className="text-2xl font-semibold">论文导出中心</h1>
      <p className="mt-1 text-sm text-slate-600">基于论文文档工作台和格式模板生成 Word 文件；PDF 入口已预留，真实生成将在后续版本开放。</p>
      <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">导出文件仅用于论文辅导、格式整理和学习支持，请根据学校正式模板、导师要求和真实资料自行核验；系统不提供代写、伪造数据或伪造引用服务。</p>
    </header>

    <form onSubmit={handleCreate} className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:grid-cols-3">
      <label className="text-sm">选择任务
        <select value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting}>
          <option value="">请选择任务</option>
          {tasks.map((task) => <option key={task.id} value={task.id}>{task.title || `任务 ${task.id.slice(0, 8)}`}</option>)}
        </select>
        {selectedTask ? <span className="mt-1 block text-xs text-slate-500">{selectedTask.schoolName ?? '未绑定学校'} / {selectedTask.majorName ?? '未绑定专业'} / {selectedTask.educationLevel ?? '未指定学历'} / {selectedTask.thesisType ?? '未指定类型'}</span> : null}
      </label>
      <label className="text-sm">导出阶段
        <select value={stage} onChange={(e) => { setStage(e.target.value); if (selectedTaskId) void loadOptions(selectedTaskId, e.target.value, format); }} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting || !selectedTaskId}>
          {(options?.availableStages ?? ['FULL_PAPER']).map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </label>
      <label className="text-sm">导出格式
        <select value={format} onChange={(e) => { setFormat(e.target.value); if (selectedTaskId) void loadOptions(selectedTaskId, stage, e.target.value); }} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting || !selectedTaskId}>
          <option value="DOCX">Word（DOCX）</option><option value="PDF">PDF（后续开放）</option>
        </select>
      </label>
      <label className="text-sm lg:col-span-2">格式模板
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting || !options?.canExport}>
          <option value="">请选择模板</option>
          {options?.matchedTemplates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}{tpl.isDefault ? '（默认）' : ''}</option>)}
        </select>
      </label>
      <div className="rounded border border-slate-200 bg-white p-3 text-xs text-slate-600">
        {selectedTemplate ? <><div className="font-medium text-slate-900">{selectedTemplate.name}</div><div>{selectedTemplate.description ?? '暂无说明'}</div><div className="mt-1">适用：{selectedTemplate.school?.name ?? '通用'} / {selectedTemplate.college?.name ?? '不限学院'} / {selectedTemplate.major?.name ?? '不限专业'} / {selectedTemplate.educationLevel ?? '不限学历'} / {selectedTemplate.thesisType ?? '不限类型'} / {selectedTemplate.stage ?? '不限阶段'}</div></> : '选择模板后查看适用范围。'}
      </div>
      <label className="text-sm lg:col-span-3">自定义格式要求
        <textarea value={customRequirement} onChange={(e) => setCustomRequirement(e.target.value)} rows={3} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" placeholder="例如：导师要求一级标题黑体三号居中，正文宋体小四，1.5 倍行距，参考文献按 GB/T 7714。" />
        <span className="mt-1 block text-xs text-slate-500">自定义格式要求会记录到导出任务中；复杂格式自动解析将在后续版本增强。</span>
      </label>
      <div className="lg:col-span-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={submitting || !options?.canExport || format === 'PDF'} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{submitting ? '创建中...' : '创建导出任务'}</button>
        {options?.document ? <span className="text-sm text-slate-600">文档：{options.document.title} · {options.document.wordCount} 字 · {new Date(options.document.updatedAt).toLocaleString()}</span> : null}
        {selectedTaskId && !options?.document ? <Link href={`/student/tasks/${encodeURIComponent(selectedTaskId)}/workbench`} className="rounded border border-slate-300 px-3 py-2 text-sm">去工作台初始化文档</Link> : null}
      </div>
    </form>

    {loading ? <div className="rounded border border-slate-200 p-4 text-sm text-slate-500">加载导出选项中...</div> : null}
    {options?.warningMessages?.map((msg) => <div key={msg} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{msg}</div>)}
    {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
    {success ? <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-medium">导出任务记录</h2>
      {!selectedTaskId ? <p className="mt-2 text-sm text-slate-500">请选择任务查看导出历史。</p> : null}
      {selectedTaskId && jobs.length === 0 ? <p className="mt-2 text-sm text-slate-500">当前任务暂无新版导出记录。</p> : null}
      <div className="mt-3 space-y-3">
        {jobs.map((job) => <div key={job.id} className="rounded border border-slate-200 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-medium">{job.fileName ?? `导出任务 ${job.id.slice(0, 8)}`}</div><div className="text-xs text-slate-500">{job.exportStage} / {job.exportFormat} / {job.template?.name ?? '未知模板'} / {new Date(job.createdAt).toLocaleString()}</div></div><div className="flex items-center gap-2"><span className="rounded bg-slate-100 px-2 py-1 text-xs">{job.status} · {job.progress}%</span>{job.status === 'SUCCESS' ? <a className="rounded bg-slate-900 px-3 py-2 text-xs text-white" href={`/api/thesis-export-jobs/${job.id}/download`}>下载</a> : null}</div></div><div className="mt-2 h-2 overflow-hidden rounded bg-slate-100"><div className={job.status === 'FAILED' ? 'h-2 bg-red-500' : job.status === 'SUCCESS' ? 'h-2 bg-emerald-600' : 'h-2 bg-sky-500'} style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }} /></div>{job.errorMessage ? <p className="mt-2 text-xs text-red-600">{job.errorMessage}</p> : null}<p className="mt-1 text-xs text-slate-500">文件大小：{formatSize(job.fileSize)}{job.customRequirement ? ' · 已记录自定义格式要求' : ''}</p></div>)}
      </div>
    </div>

    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-medium">旧版下载记录（兼容保留）</h2>
      {legacyItems.length === 0 ? <p className="mt-2 text-sm text-slate-500">暂无旧版导出记录。</p> : null}
      <div className="mt-3 space-y-2">{legacyItems.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 p-3 text-sm"><div><div>{item.title || item.id}</div><div className="text-xs text-slate-500">模板：{item.template} · 范围：{item.scope} · 状态：{item.status} · 进度：{item.progress}%</div>{item.errorMessage ? <div className="text-xs text-red-600">{item.errorMessage}</div> : null}</div>{item.status === 'SUCCESS' ? <a href={`/api/export/${item.id}/download`} className="rounded border border-slate-300 px-3 py-2 text-xs">下载旧文件</a> : null}</div>)}</div>
    </div>
  </section>;
}