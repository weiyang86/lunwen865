'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { thesisExportAdminApi, type ThesisExportJob, type ThesisFormatRule, type ThesisFormatTemplate } from '@/services/admin/thesis-export';

const EMPTY_TEMPLATE = { name: '', code: '', description: '', templateType: 'GENERAL', status: 'ENABLED', isDefault: false, version: 1, sortOrder: 0, educationLevel: '', thesisType: '', stage: '', schoolId: '', collegeId: '', majorId: '' };
const RULE_TYPES = ['PAGE','TITLE','BODY','HEADING','ABSTRACT','KEYWORDS','TOC','REFERENCE','COVER','FOOTER','HEADER','CUSTOM'];
const TEMPLATE_TYPES = ['','GENERAL','SCHOOL','COLLEGE','MAJOR','CUSTOM'];
const STATUSES = ['','ENABLED','DISABLED'];

type TemplateForm = Record<string, any>;

function normalizeTemplateBody(form: TemplateForm) {
  const body: Record<string, unknown> = { ...form, isDefault: Boolean(form.isDefault), version: Number(form.version || 1), sortOrder: Number(form.sortOrder || 0) };
  for (const key of ['schoolId', 'collegeId', 'majorId', 'educationLevel', 'thesisType', 'stage']) if (!body[key]) body[key] = undefined;
  return body;
}

export function ThesisFormatTemplatesAdmin({ mode = 'templates' }: { mode?: 'templates' | 'jobs' }) {
  const [templates, setTemplates] = useState<ThesisFormatTemplate[]>([]);
  const [jobs, setJobs] = useState<ThesisExportJob[]>([]);
  const [selected, setSelected] = useState<ThesisFormatTemplate | null>(null);
  const [rules, setRules] = useState<ThesisFormatRule[]>([]);
  const [form, setForm] = useState<TemplateForm>(EMPTY_TEMPLATE);
  const [filters, setFilters] = useState({ keyword: '', schoolId: '', majorId: '', educationLevel: '', thesisType: '', stage: '', status: '', templateType: '' });
  const [ruleForm, setRuleForm] = useState({ ruleType: 'BODY', ruleKey: 'body', ruleValue: '{"fontFamily":"宋体","fontSize":"小四","lineSpacing":1.5}', description: '', sortOrder: 0 });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const data = await thesisExportAdminApi.templates({ ...params, page: 1, pageSize: 50 });
    setTemplates(data.items ?? []);
  }, [filters]);
  async function loadJobs() {
    const data = await thesisExportAdminApi.jobs({ page: 1, pageSize: 50 });
    setJobs(data.items ?? []);
  }
  useEffect(() => { void loadJobs(); }, []);
  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  async function selectTemplate(t: ThesisFormatTemplate) {
    setSelected(t);
    setForm({
      ...EMPTY_TEMPLATE,
      name: t.name,
      code: t.code,
      description: t.description ?? '',
      templateType: t.templateType,
      status: t.status,
      isDefault: t.isDefault,
      version: t.version,
      sortOrder: t.sortOrder,
      educationLevel: t.educationLevel ?? '',
      thesisType: t.thesisType ?? '',
      stage: t.stage ?? '',
      schoolId: t.schoolId ?? '',
      collegeId: t.collegeId ?? '',
      majorId: t.majorId ?? '',
    });
    setRules(await thesisExportAdminApi.rules(t.id));
  }

  async function submitTemplate(e: FormEvent) {
    e.preventDefault();
    setError(null); setMessage(null);
    try {
      const body = normalizeTemplateBody(form);
      const saved = selected ? await thesisExportAdminApi.updateTemplate(selected.id, body) : await thesisExportAdminApi.createTemplate(body);
      setMessage('模板已保存');
      await loadTemplates();
      await selectTemplate(saved);
    } catch (err) { setError(err instanceof Error ? err.message : '保存模板失败，请检查 code 唯一性和输入内容'); }
  }

  async function submitRule(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null); setMessage(null);
    try {
      JSON.parse(ruleForm.ruleValue);
      await thesisExportAdminApi.createRule(selected.id, { ...ruleForm, sortOrder: Number(ruleForm.sortOrder || 0), ruleValue: ruleForm.ruleValue });
      setRules(await thesisExportAdminApi.rules(selected.id));
      setMessage('规则已新增');
    } catch { setError('规则保存失败，请确认 ruleValue 是合法 JSON，且 ruleKey 未重复。'); }
  }

  async function toggleTemplate(template: ThesisFormatTemplate) {
    const status = template.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    await thesisExportAdminApi.updateTemplate(template.id, { status });
    setMessage(status === 'ENABLED' ? '模板已启用' : '模板已禁用');
    await loadTemplates();
    if (selected?.id === template.id) await selectTemplate({ ...template, status });
  }

  if (mode === 'jobs') return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"><h1 className="text-2xl font-semibold">论文导出任务</h1><p className="text-sm text-slate-600">查看新版 ThesisExportJob 状态、失败原因并重试失败任务。</p><div className="space-y-3">{jobs.map((job) => <div key={job.id} className="rounded border border-slate-200 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><div><div className="font-medium">{job.fileName ?? job.id}</div><div className="text-xs text-slate-500">任务：{job.task?.title ?? job.taskId} · 模板：{job.template?.name ?? '—'} · 用户：{job.user?.nickname ?? job.user?.phone ?? job.user?.email ?? '—'}</div><div className="text-xs text-slate-500">{job.exportStage} / {job.exportFormat} / {job.status} / {job.progress}%</div>{job.errorMessage ? <div className="text-xs text-red-600">{job.errorMessage}</div> : null}</div>{job.status === 'FAILED' ? <button className="rounded border border-slate-300 px-3 py-2 text-xs" onClick={() => thesisExportAdminApi.retryJob(job.id).then(loadJobs)}>重试</button> : null}</div></div>)}</div></section>;

  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"><h1 className="text-2xl font-semibold">论文格式模板</h1><p className="text-sm text-slate-600">维护高校/学院/专业/学历/阶段格式模板。示例高校模板仅用于演示，不代表官方模板。</p>{message ? <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}{error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
    <div className="grid gap-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-4"><input className="rounded border px-3 py-2" placeholder="搜索名称 / code" value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="schoolId" value={filters.schoolId} onChange={(e) => setFilters({ ...filters, schoolId: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="majorId" value={filters.majorId} onChange={(e) => setFilters({ ...filters, majorId: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="学历层次" value={filters.educationLevel} onChange={(e) => setFilters({ ...filters, educationLevel: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="论文类型" value={filters.thesisType} onChange={(e) => setFilters({ ...filters, thesisType: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="阶段" value={filters.stage} onChange={(e) => setFilters({ ...filters, stage: e.target.value })} /><select className="rounded border px-3 py-2" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>{STATUSES.map((x) => <option key={x} value={x}>{x || '全部状态'}</option>)}</select><select className="rounded border px-3 py-2" value={filters.templateType} onChange={(e) => setFilters({ ...filters, templateType: e.target.value })}>{TEMPLATE_TYPES.map((x) => <option key={x} value={x}>{x || '全部类型'}</option>)}</select></div>
    <div className="grid gap-4 lg:grid-cols-[420px_1fr]"><aside className="space-y-2"><button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => { setSelected(null); setRules([]); setForm(EMPTY_TEMPLATE); }}>新增模板</button>{templates.map((tpl) => <div key={tpl.id} className={`rounded border px-3 py-2 text-sm ${selected?.id === tpl.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}><button onClick={() => void selectTemplate(tpl)} className="block w-full text-left"><div className="font-medium">{tpl.name}</div><div className="text-xs text-slate-500">{tpl.code} · {tpl.templateType} · {tpl.status} · v{tpl.version} {tpl.isDefault ? '· 默认' : ''}</div><div className="text-xs text-slate-500">{tpl.school?.name ?? '通用'} / {tpl.college?.name ?? '不限学院'} / {tpl.major?.name ?? '不限专业'} / {tpl.educationLevel ?? '不限学历'} / {tpl.thesisType ?? '不限类型'} / {tpl.stage ?? '不限阶段'}</div></button><div className="mt-2 flex gap-2"><button className="text-xs text-indigo-600" onClick={() => void toggleTemplate(tpl)}>{tpl.status === 'ENABLED' ? '禁用' : '启用'}</button></div></div>)}</aside><main className="space-y-4"><form onSubmit={submitTemplate} className="grid gap-3 md:grid-cols-2"><input className="rounded border px-3 py-2" placeholder="模板名称" value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><input className="rounded border px-3 py-2" placeholder="code" value={String(form.code ?? '')} onChange={(e) => setForm({ ...form, code: e.target.value })} required /><select className="rounded border px-3 py-2" value={String(form.templateType ?? 'GENERAL')} onChange={(e) => setForm({ ...form, templateType: e.target.value })}>{TEMPLATE_TYPES.filter(Boolean).map((x) => <option key={x}>{x}</option>)}</select><select className="rounded border px-3 py-2" value={String(form.status ?? 'ENABLED')} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>ENABLED</option><option>DISABLED</option></select><input className="rounded border px-3 py-2" placeholder="schoolId" value={String(form.schoolId ?? '')} onChange={(e) => setForm({ ...form, schoolId: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="collegeId" value={String(form.collegeId ?? '')} onChange={(e) => setForm({ ...form, collegeId: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="majorId" value={String(form.majorId ?? '')} onChange={(e) => setForm({ ...form, majorId: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="学历层次" value={String(form.educationLevel ?? '')} onChange={(e) => setForm({ ...form, educationLevel: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="论文类型" value={String(form.thesisType ?? '')} onChange={(e) => setForm({ ...form, thesisType: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="阶段" value={String(form.stage ?? '')} onChange={(e) => setForm({ ...form, stage: e.target.value })} /><input className="rounded border px-3 py-2" type="number" placeholder="版本" value={Number(form.version ?? 1)} onChange={(e) => setForm({ ...form, version: e.target.value })} /><input className="rounded border px-3 py-2" type="number" placeholder="排序" value={Number(form.sortOrder ?? 0)} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.isDefault)} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />默认模板</label><textarea className="rounded border px-3 py-2 md:col-span-2" placeholder="模板说明" value={String(form.description ?? '')} onChange={(e) => setForm({ ...form, description: e.target.value })} /><button className="rounded bg-slate-900 px-3 py-2 text-sm text-white md:col-span-2">保存模板</button></form>{selected ? <div className="rounded border border-slate-200 p-3"><h2 className="font-medium">格式规则</h2><form onSubmit={submitRule} className="mt-3 grid gap-2 md:grid-cols-4"><select className="rounded border px-2 py-2" value={ruleForm.ruleType} onChange={(e) => setRuleForm({ ...ruleForm, ruleType: e.target.value })}>{RULE_TYPES.map((x) => <option key={x}>{x}</option>)}</select><input className="rounded border px-2 py-2" value={ruleForm.ruleKey} onChange={(e) => setRuleForm({ ...ruleForm, ruleKey: e.target.value })} placeholder="ruleKey" /><input className="rounded border px-2 py-2" value={ruleForm.description} onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })} placeholder="说明" /><button className="rounded border px-2 py-2 text-sm">新增规则</button><textarea className="rounded border px-2 py-2 font-mono text-xs md:col-span-4" rows={5} value={ruleForm.ruleValue} onChange={(e) => setRuleForm({ ...ruleForm, ruleValue: e.target.value })} /></form><div className="mt-3 space-y-2">{rules.map((r) => <div key={r.id} className="rounded bg-slate-50 p-2 text-xs"><div className="flex justify-between gap-2"><div className="font-medium">{r.ruleType} / {r.ruleKey}</div><button className="text-rose-600" onClick={() => thesisExportAdminApi.deleteRule(r.id).then(() => selected && selectTemplate(selected))}>删除</button></div><pre className="whitespace-pre-wrap">{JSON.stringify(r.ruleValue, null, 2)}</pre></div>)}</div></div> : null}</main></div></section>;
}
