'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';

type RuleSummary = { id?: string; ruleType: string; ruleKey: string; ruleValue: unknown; description?: string | null; sortOrder?: number };
type FormatTemplate = { id: string; name: string; code: string; description?: string | null; templateType: string; isDefault: boolean; status: string; version: number; sortOrder: number; school?: { name: string } | null; college?: { name: string } | null; major?: { name: string } | null; educationLevel?: string | null; thesisType?: string | null; stage?: string | null; rulesSummary?: RuleSummary[] };
type FormatSetting = { id: string; documentId: string; templateId?: string | null; overrideRules?: Record<string, unknown> | null; customRequirement?: string | null; previewMode?: string | null; template?: FormatTemplate | null };
type TemplateResp = { matchedTemplates: FormatTemplate[]; defaultTemplate: FormatTemplate | null; currentSetting: FormatSetting | null; warningMessages: string[] };
type SettingResp = { currentSetting: FormatSetting | null; defaultTemplate: FormatTemplate | null; rulesSummary: RuleSummary[]; warningMessages: string[] };

type OverrideRules = {
  bodyFontFamily: string;
  bodyFontSize: string;
  bodyLineSpacing: string;
  firstLineIndent: string;
  heading1FontSize: string;
  heading1Alignment: string;
  heading2FontSize: string;
  referenceStyle: string;
};

const EMPTY_OVERRIDES: OverrideRules = {
  bodyFontFamily: '',
  bodyFontSize: '',
  bodyLineSpacing: '',
  firstLineIndent: '',
  heading1FontSize: '',
  heading1Alignment: '',
  heading2FontSize: '',
  referenceStyle: '',
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringifyRule(value: unknown) {
  const record = toRecord(value);
  const pairs = Object.entries(record).map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join('、') : String(val)}`);
  return pairs.length ? pairs.join('；') : JSON.stringify(value);
}

function templateScope(template?: FormatTemplate | null) {
  if (!template) return '暂无模板';
  return [template.school?.name ?? '通用学校', template.college?.name ?? '不限学院', template.major?.name ?? '不限专业', template.educationLevel ?? '不限学历', template.thesisType ?? '不限类型', template.stage ?? '不限阶段'].join(' / ');
}

function overridesFromSetting(setting?: FormatSetting | null): OverrideRules {
  return { ...EMPTY_OVERRIDES, ...toRecord(setting?.overrideRules) } as OverrideRules;
}

function compactOverrides(overrides: OverrideRules) {
  return Object.fromEntries(Object.entries(overrides).filter(([, value]) => String(value ?? '').trim() !== ''));
}

export function ThesisFormatSettingsPanel({ taskId, documentId, onMessage }: { taskId: string; documentId: string; onMessage: (message: string) => void }) {
  const [templates, setTemplates] = useState<FormatTemplate[]>([]);
  const [defaultTemplate, setDefaultTemplate] = useState<FormatTemplate | null>(null);
  const [setting, setSetting] = useState<FormatSetting | null>(null);
  const [rulesSummary, setRulesSummary] = useState<RuleSummary[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<OverrideRules>(EMPTY_OVERRIDES);
  const [customRequirement, setCustomRequirement] = useState('');
  const [previewMode, setPreviewMode] = useState('SIMPLE');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTemplate = setting?.template ?? templates.find((tpl) => tpl.id === selectedTemplateId) ?? defaultTemplate;
  const displayRules = activeTemplate?.rulesSummary?.length ? activeTemplate.rulesSummary : rulesSummary;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templateResp, settingResp] = await Promise.all([
        clientHttp.get<TemplateResp>(`/thesis-tasks/${encodeURIComponent(taskId)}/format-templates`),
        clientHttp.get<SettingResp>(`/thesis-documents/${encodeURIComponent(documentId)}/format-setting`),
      ]);
      setTemplates(templateResp.matchedTemplates ?? []);
      setDefaultTemplate(settingResp.defaultTemplate ?? templateResp.defaultTemplate ?? null);
      setSetting(settingResp.currentSetting ?? templateResp.currentSetting ?? null);
      setRulesSummary(settingResp.rulesSummary ?? []);
      setWarnings([...(templateResp.warningMessages ?? []), ...(settingResp.warningMessages ?? [])]);
      const nextSetting = settingResp.currentSetting ?? templateResp.currentSetting ?? null;
      setSelectedTemplateId(nextSetting?.templateId ?? settingResp.defaultTemplate?.id ?? templateResp.defaultTemplate?.id ?? '');
      setOverrides(overridesFromSetting(nextSetting));
      setCustomRequirement(nextSetting?.customRequirement ?? '');
      setPreviewMode(nextSetting?.previewMode ?? 'SIMPLE');
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, '加载格式设置失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }, [documentId, taskId]);

  useEffect(() => { void load(); }, [load]);

  async function applyTemplate(keepOverrides: boolean) {
    if (!selectedTemplateId) {
      setError('暂无可应用模板，请联系管理员配置。');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const resp = await clientHttp.post<{ setting: FormatSetting; template: FormatTemplate; rulesSummary: RuleSummary[]; message?: string }>(`/thesis-documents/${encodeURIComponent(documentId)}/apply-format-template`, { templateId: selectedTemplateId, keepOverrides });
      setSetting(resp.setting);
      setRulesSummary(resp.rulesSummary ?? []);
      if (!keepOverrides) setOverrides(EMPTY_OVERRIDES);
      onMessage(resp.message ?? '已应用模板到当前论文。');
      await load();
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, '应用模板失败，请稍后重试。'));
    } finally {
      setSaving(false);
    }
  }

  async function saveSetting() {
    setSaving(true);
    setError(null);
    try {
      const resp = await clientHttp.patch<{ setting: FormatSetting; template: FormatTemplate | null; rulesSummary: RuleSummary[] }>(`/thesis-documents/${encodeURIComponent(documentId)}/format-setting`, {
        templateId: selectedTemplateId || undefined,
        overrideRules: compactOverrides(overrides),
        customRequirement,
        previewMode,
      });
      setSetting(resp.setting);
      setRulesSummary(resp.rulesSummary ?? []);
      onMessage('格式配置已保存，后续生成 Word 初稿时将优先使用当前配置。');
      await load();
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, '保存格式配置失败，请稍后重试。'));
    } finally {
      setSaving(false);
    }
  }

  const ruleGroups = useMemo(() => {
    const keys = ['PAGE', 'BODY', 'HEADING', 'ABSTRACT', 'KEYWORDS', 'REFERENCE', 'COVER'];
    return keys.map((key) => ({ key, rules: displayRules.filter((rule) => rule.ruleType === key) })).filter((group) => group.rules.length);
  }, [displayRules]);

  return <div className="space-y-4 text-sm">
    <div className="rounded border border-indigo-200 bg-indigo-50 p-3 text-indigo-800">当前页面为在线编辑与近似预览效果，最终排版以生成的 Word 文件为准。格式模板只保存排版配置，不会修改章节正文内容。</div>
    {loading ? <div className="rounded border border-slate-200 bg-white p-3 text-slate-500">加载格式设置...</div> : null}
    {error ? <div className="rounded border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</div> : null}
    {warnings.length ? <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-800">{Array.from(new Set(warnings)).join('；')}</div> : null}

    <div className="rounded border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div><h3 className="font-medium">当前格式模板</h3><p className="mt-1 text-xs text-slate-500">{activeTemplate ? templateScope(activeTemplate) : '暂无可用模板，请联系管理员配置'}</p></div>
        {activeTemplate?.isDefault ? <span className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">默认</span> : null}
      </div>
      <div className="mt-2 font-medium text-slate-900">{activeTemplate?.name ?? '未应用模板'}</div>
      <p className="mt-1 text-xs text-slate-500">{activeTemplate?.description ?? '可以先填写自定义格式要求，待管理员配置模板后再应用。'}</p>
    </div>

    <div className="rounded border border-slate-200 bg-white p-3">
      <h3 className="font-medium">切换模板</h3>
      {templates.length ? <select className="mt-2 w-full rounded border border-slate-300 px-3 py-2" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>{templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name} · {tpl.templateType} · {tpl.isDefault ? '默认' : '可选'}</option>)}</select> : <div className="mt-2 text-slate-500">暂无可用模板，请联系管理员配置。</div>}
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={saving || !selectedTemplateId} onClick={() => void applyTemplate(true)} className="rounded bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-50">应用并保留微调</button><button type="button" disabled={saving || !selectedTemplateId} onClick={() => void applyTemplate(false)} className="rounded border border-slate-300 px-3 py-2 text-xs disabled:opacity-50">应用并清空微调</button></div>
    </div>

    <div className="rounded border border-slate-200 bg-white p-3">
      <h3 className="font-medium">格式规则摘要</h3>
      <div className="mt-2 space-y-2">{ruleGroups.length ? ruleGroups.map((group) => <div key={group.key} className="rounded bg-slate-50 p-2"><div className="font-medium text-slate-700">{group.key}</div>{group.rules.map((rule) => <div key={rule.id ?? rule.ruleKey} className="mt-1 text-xs text-slate-600">{rule.description ?? rule.ruleKey}：{stringifyRule(rule.ruleValue)}</div>)}</div>) : <div className="text-slate-500">暂无规则摘要。</div>}</div>
    </div>

    <div className="rounded border border-slate-200 bg-white p-3">
      <h3 className="font-medium">局部格式微调</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {([
          ['bodyFontFamily', '正文字体', '宋体'], ['bodyFontSize', '正文字号', '小四'], ['bodyLineSpacing', '正文行距', '1.5'], ['firstLineIndent', '首行缩进', '2字符'], ['heading1FontSize', '一级标题字号', '三号'], ['heading1Alignment', '一级标题对齐', 'center'], ['heading2FontSize', '二级标题字号', '四号'], ['referenceStyle', '参考文献格式', 'GB/T 7714'],
        ] as const).map(([key, label, placeholder]) => <label key={key} className="text-xs text-slate-600">{label}<input className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={overrides[key]} placeholder={placeholder} onChange={(e) => setOverrides({ ...overrides, [key]: e.target.value })} /></label>)}
      </div>
    </div>

    <div className="rounded border border-slate-200 bg-white p-3">
      <h3 className="font-medium">自定义格式要求</h3>
      <p className="mt-1 text-xs text-slate-500">自定义格式要求会保存到当前论文格式配置中。复杂自然语言格式解析将在后续版本逐步增强。</p>
      <textarea className="mt-2 w-full rounded border border-slate-300 px-3 py-2" rows={4} maxLength={2000} value={customRequirement} placeholder="例如：导师要求一级标题黑体三号居中，正文宋体小四，1.5 倍行距，参考文献按 GB/T 7714。" onChange={(e) => setCustomRequirement(e.target.value)} />
      <div className="mt-2 flex items-center justify-between gap-2"><select className="rounded border border-slate-300 px-2 py-1.5 text-xs" value={previewMode} onChange={(e) => setPreviewMode(e.target.value)}><option value="SIMPLE">SIMPLE 近似预览</option><option value="PAPER_LIKE">PAPER_LIKE 纸张预览</option></select><button type="button" disabled={saving} onClick={() => void saveSetting()} className="rounded bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-50">{saving ? '保存中...' : '保存格式配置'}</button></div>
    </div>
  </div>;
}
