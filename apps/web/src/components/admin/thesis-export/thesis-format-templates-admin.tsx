'use client';

import { FormEvent, useEffect, useState } from 'react';
import { thesisExportAdminApi, type ThesisExportJob, type ThesisFormatRule, type ThesisFormatTemplate } from '@/services/admin/thesis-export';

const EMPTY_TEMPLATE = { name: '', code: '', description: '', templateType: 'GENERAL', status: 'ENABLED', isDefault: false, version: 1, sortOrder: 0, educationLevel: '', thesisType: '', stage: '', schoolId: '', collegeId: '', majorId: '' };

export function ThesisFormatTemplatesAdmin({ mode = 'templates' }: { mode?: 'templates' | 'jobs' }) {
  const [templates, setTemplates] = useState<ThesisFormatTemplate[]>([]);
  const [jobs, setJobs] = useState<ThesisExportJob[]>([]);
  const [selected, setSelected] = useState<ThesisFormatTemplate | null>(null);
  const [rules, setRules] = useState<ThesisFormatRule[]>([]);
  const [form, setForm] = useState<Record<string, any>>(EMPTY_TEMPLATE);
  const [ruleForm, setRuleForm] = useState({ ruleType: 'BODY', ruleKey: 'body', ruleValue: '{"fontFamily":"宋体","fontSize":12,"lineSpacing":1.5}', description: '', sortOrder: 0 });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadTemplates() {
    const data = await thesisExportAdminApi.templates({ page: 1, pageSize: 50 });
    setTemplates(data.items ?? []);
  }
  async function loadJobs() {
    const data = await thesisExportAdminApi.jobs({ page: 1, pageSize: 50 });
    setJobs(data.items ?? []);
  }
  useEffect(() => { void loadTemplates(); void loadJobs(); }, []);

  async function selectTemplate(t: ThesisFormatTemplate) {
    setSelected(t);
    setForm({ ...EMPTY_TEMPLATE, ...t });
    setRules(await thesisExportAdminApi.rules(t.id));
  }

  async function submitTemplate(e: FormEvent) {
    e.preventDefault();
    setError(null); setMessage(null);
    try {
      const body: Record<string, unknown> = { ...form, isDefault: Boolean(form.isDefault), version: Number(form.version || 1), sortOrder: Number(form.sortOrder || 0) };
      for (const key of ['schoolId', 'collegeId', 'majorId', 'educationLevel', 'thesisType', 'stage']) if (!body[key]) body[key] = undefined;
      const saved = selected ? await thesisExportAdminApi.updateTemplate(selected.id, body) : await thesisExportAdminApi.createTemplate(body);
      setMessage('模板已保存');
      await loadTemplates();
      await selectTemplate(saved);
    } catch (err) { setError(err instanceof Error ? err.message : '保存模板失败，请检查 code 唯一性和 JSON 输入'); }
  }

  async function submitRule(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null); setMessage(null);
    try {
      await thesisExportAdminApi.createRule(selected.id, { ...ruleForm, sortOrder: Number(ruleForm.sortOrder || 0), ruleValue: JSON.parse(ruleForm.ruleValue) });
      setRules(await thesisExportAdminApi.rules(selected.id));
      setMessage('规则已新增');
    } catch { setError('规则保存失败，请确认 ruleValue 是合法 JSON，且 ruleKey 未重复。'); }
  }

  if (mode === 'jobs') return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"><h1 className="text-2xl font-semibold">论文导出任务</h1><p className="text-sm text-slate-600">查看新版 ThesisExportJob 状态、失败原因并重试失败任务。</p><div className="space-y-3">{jobs.map((job) => <div key={job.id} className="rounded border border-slate-200 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><div><div className="font-medium">{job.fileName ?? job.id}</div><div className="text-xs text-slate-500">任务：{job.task?.title ?? job.taskId} · 模板：{job.template?.name ?? '—'} · 用户：{job.user?.nickname ?? job.user?.phone ?? job.user?.email ?? '—'}</div><div className="text-xs text-slate-500">{job.exportStage} / {job.exportFormat} / {job.status} / {job.progress}%</div>{job.errorMessage ? <div className="text-xs text-red-600">{job.errorMessage}</div> : null}</div>{job.status === 'FAILED' ? <button className="rounded border border-slate-300 px-3 py-2 text-xs" onClick={() => thesisExportAdminApi.retryJob(job.id).then(loadJobs)}>重试</button> : null}</div></div>)}</div></section>;

  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"><h1 className="text-2xl font-semibold">论文格式模板</h1><p className="text-sm text-slate-600">维护高校/学院/专业/学历/阶段格式模板。示例高校模板仅用于演示，不代表官方模板。</p>{message ? <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}{error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}<div className="grid gap-4 lg:grid-cols-[360px_1fr]"><aside className="space-y-2"> <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => { setSelected(null); setRules([]); setForm(EMPTY_TEMPLATE); }}>新增模板</button>{templates.map((tpl) => <button key={tpl.id} onClick={() => void selectTemplate(tpl)} className={`block w-full rounded border px-3 py-2 text-left text-sm ${selected?.id === tpl.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}><div className="font-medium">{tpl.name}</div><div className="text-xs text-slate-500">{tpl.templateType} · {tpl.status} · v{tpl.version} {tpl.isDefault ? '· 默认' : ''}</div><div className="text-xs text-slate-500">{tpl.school?.name ?? '通用'} / {tpl.major?.name ?? '不限专业'} / {tpl.stage ?? '不限阶段'}</div></button>)}</aside><main className="space-y-4"><form onSubmit={submitTemplate} className="grid gap-3 md:grid-cols-2"><input className="rounded border px-3 py-2" placeholder="模板名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><input className="rounded border px-3 py-2" placeholder="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /><select className="rounded border px-3 py-2" value={form.templateType} onChange={(e) => setForm({ ...form, templateType: e.target.value })}><option>GENERAL</option><option>SCHOOL</option><option>COLLEGE</option><option>MAJOR</option><option>CUSTOM</option></select><select className="rounded border px-3 py-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>ENABLED</option><option>DISABLED</option></select><input className="rounded border px-3 py-2" placeholder="schoolId" value={form.schoolId ?? ''} onChange={(e) => setForm({ ...form, schoolId: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="majorId" value={form.majorId ?? ''} onChange={(e) => setForm({ ...form, majorId: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="学历层次" value={form.educationLevel ?? ''} onChange={(e) => setForm({ ...form, educationLevel: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="论文类型" value={form.thesisType ?? ''} onChange={(e) => setForm({ ...form, thesisType: e.target.value })} /><input className="rounded border px-3 py-2" placeholder="阶段" value={form.stage ?? ''} onChange={(e) => setForm({ ...form, stage: e.target.value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.isDefault)} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />默认模板</label><textarea className="rounded border px-3 py-2 md:col-span-2" placeholder="模板说明" value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /><button className="rounded bg-slate-900 px-3 py-2 text-sm text-white md:col-span-2">保存模板</button></form>{selected ? <div className="rounded border border-slate-200 p-3"><h2 className="font-medium">格式规则</h2><form onSubmit={submitRule} className="mt-3 grid gap-2 md:grid-cols-4"><select className="rounded border px-2 py-2" value={ruleForm.ruleType} onChange={(e) => setRuleForm({ ...ruleForm, ruleType: e.target.value })}>{['PAGE','TITLE','BODY','HEADING','ABSTRACT','KEYWORDS','TOC','REFERENCE','COVER','FOOTER','HEADER','CUSTOM'].map((x) => <option key={x}>{x}</option>)}</select><input className="rounded border px-2 py-2" value={ruleForm.ruleKey} onChange={(e) => setRuleForm({ ...ruleForm, ruleKey: e.target.value })} placeholder="ruleKey" /><input className="rounded border px-2 py-2" value={ruleForm.description} onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })} placeholder="说明" /><button className="rounded border px-2 py-2 text-sm">新增规则</button><textarea className="rounded border px-2 py-2 md:col-span-4" rows={3} value={ruleForm.ruleValue} onChange={(e) => setRuleForm({ ...ruleForm, ruleValue: e.target.value })} /></form><div className="mt-3 space-y-2">{rules.map((r) => <div key={r.id} className="rounded bg-slate-50 p-2 text-xs"><div className="font-medium">{r.ruleType} / {r.ruleKey}</div><pre className="whitespace-pre-wrap">{JSON.stringify(r.ruleValue, null, 2)}</pre></div>)}</div></div> : null}</main></div></section>;
}
