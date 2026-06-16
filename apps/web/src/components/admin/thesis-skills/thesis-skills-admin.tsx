'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlaskConical, ListChecks, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { academicApi } from '@/services/admin/academic';
import { thesisSkillApi } from '@/services/admin/thesis-skills';
import type { AcademicMajor, AcademicSchool, DisciplineTree } from '@/types/admin/academic';
import type { ThesisSkill, ThesisSkillBinding, ThesisSkillCategory, ThesisSkillRun, ThesisSkillStage, ThesisSkillStatus, ThesisSkillVersion } from '@/types/admin/thesis-skill';

const STAGES: ThesisSkillStage[] = ['TOPIC', 'PROPOSAL', 'OUTLINE', 'FULL_PAPER', 'REVISION', 'POLISHING', 'FORMAT_CHECK', 'REFERENCE', 'ABSTRACT', 'DEFENSE'];
const CATEGORIES: ThesisSkillCategory[] = ['GENERATION', 'REVISION', 'CHECK', 'EXPORT_ASSIST'];
const STATUSES: ThesisSkillStatus[] = ['ENABLED', 'DISABLED'];

const DEFAULT_JSON = '{\n  "type": "object"\n}';
const DEFAULT_MODEL = '{\n  "provider": "mock-preview",\n  "model": "skill-preview-v1",\n  "temperature": 0.3\n}';
const DEFAULT_PROMPT = `你是论文辅导与写作辅助 Skill。\n\n合规边界：不代写论文，不伪造数据，不伪造引用，不承诺规避查重。\n\n题目：{{taskTitle}}\n学校：{{schoolName}}\n专业：{{majorName}}\n学历：{{educationLevel}}\n论文类型：{{thesisType}}\n研究方向：{{researchDirection}}\n导师要求：{{advisorRequirement}}\n用户要求：{{userRequirement}}\n\n请输出结构化建议。`;

type SkillDraft = { name: string; code: string; description: string; stage: ThesisSkillStage; category: ThesisSkillCategory; status: ThesisSkillStatus; sortOrder: string };
type VersionDraft = { version: string; promptTemplate: string; inputSchema: string; outputSchema: string; qualityRules: string; modelConfig: string; isActive: boolean; changeLog: string };
type BindingDraft = { skillVersionId: string; educationLevel: string; thesisType: string; schoolId: string; majorId: string; disciplineCategoryId: string; disciplineLevelOneId: string; disciplineLevelTwoId: string; priority: string; status: ThesisSkillStatus };
type TestDraft = { taskTitle: string; schoolName: string; collegeName: string; majorName: string; educationLevel: string; thesisType: string; researchDirection: string; advisorRequirement: string; userRequirement: string };

const EMPTY_SKILL: SkillDraft = { name: '', code: '', description: '', stage: 'TOPIC', category: 'GENERATION', status: 'ENABLED', sortOrder: '0' };
const EMPTY_VERSION: VersionDraft = { version: '', promptTemplate: DEFAULT_PROMPT, inputSchema: DEFAULT_JSON, outputSchema: DEFAULT_JSON, qualityRules: DEFAULT_JSON, modelConfig: DEFAULT_MODEL, isActive: true, changeLog: '' };
const EMPTY_BINDING: BindingDraft = { skillVersionId: '', educationLevel: '', thesisType: '', schoolId: '', majorId: '', disciplineCategoryId: '', disciplineLevelOneId: '', disciplineLevelTwoId: '', priority: '0', status: 'ENABLED' };
const EMPTY_TEST: TestDraft = { taskTitle: '', schoolName: '', collegeName: '', majorName: '', educationLevel: 'UNDERGRADUATE', thesisType: 'UNDERGRAD_THESIS', researchDirection: '', advisorRequirement: '', userRequirement: '' };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs ${props.className ?? ''}`} />;
}

function StatusBadge({ status }: { status: ThesisSkillStatus | string }) {
  const enabled = status === 'ENABLED' || status === 'SUCCESS';
  return <span className={enabled ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700' : 'rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600'}>{status}</span>;
}

function parseJson(text: string, label: string) {
  try {
    return JSON.parse(text || '{}') as Record<string, unknown>;
  } catch {
    throw new Error(`${label} 不是合法 JSON`);
  }
}

function pretty(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function ThesisSkillsListPage() {
  const [loading, setLoading] = useState(false);
  const [skills, setSkills] = useState<ThesisSkill[]>([]);
  const [keyword, setKeyword] = useState('');
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState<SkillDraft>(EMPTY_SKILL);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await thesisSkillApi.list({ keyword, stage: stage || undefined, status: status || undefined, pageSize: 100 });
      setSkills(data.list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSkill() {
    if (!draft.name.trim() || !draft.code.trim()) {
      toast.error('请填写 Skill 名称和编码');
      return;
    }
    const body = { ...draft, sortOrder: Number(draft.sortOrder || 0) };
    if (editingId) await thesisSkillApi.update(editingId, body);
    else await thesisSkillApi.create(body);
    toast.success(editingId ? 'Skill 已更新' : 'Skill 已新增');
    setEditingId(null);
    setDraft(EMPTY_SKILL);
    await refresh();
  }

  async function toggleSkill(skill: ThesisSkill) {
    if (skill.status === 'ENABLED') await thesisSkillApi.disable(skill.id);
    else await thesisSkillApi.update(skill.id, { status: 'ENABLED' });
    toast.success(skill.status === 'ENABLED' ? 'Skill 已禁用' : 'Skill 已启用');
    await refresh();
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div><h1 className="text-2xl font-semibold">论文 Skill 中心</h1><p className="text-sm text-muted-foreground">维护可版本化、可绑定范围、可测试运行的论文辅导 Skill。</p></div>
        <div className="flex gap-2"><Button variant="outline" asChild><Link href="/admin/thesis-skills/runs"><ListChecks className="mr-2 size-4" />运行记录</Link></Button><Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className="mr-2 size-4" />刷新</Button></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>{editingId ? '编辑 Skill' : '新增 Skill'}</CardTitle><CardDescription>Skill 是阶段化论文辅导能力，不是简单 Prompt 文本。</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Field label="名称"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="编码"><Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="topic-generation" /></Field>
            <Field label="阶段"><NativeSelect value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value as ThesisSkillStage })}>{STAGES.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Field>
            <Field label="类型"><NativeSelect value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as ThesisSkillCategory })}>{CATEGORIES.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Field>
            <Field label="状态"><NativeSelect value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ThesisSkillStatus })}>{STATUSES.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Field>
            <Field label="排序"><Input value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} /></Field>
            <Field label="描述"><Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
            <Button className="w-full" onClick={() => void saveSkill()}><Plus className="mr-2 size-4" />保存 Skill</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Skill 列表</CardTitle><CardDescription>支持按阶段、状态和关键词筛选。</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索名称 / code" />
              <NativeSelect value={stage} onChange={(e) => setStage(e.target.value)}><option value="">全部阶段</option>{STAGES.map((x) => <option key={x}>{x}</option>)}</NativeSelect>
              <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="">全部状态</option>{STATUSES.map((x) => <option key={x}>{x}</option>)}</NativeSelect>
              <Button onClick={() => void refresh()}>搜索</Button>
            </div>
            <Table><TableHeader><TableRow>{['名称', 'code', '阶段', '类型', '状态', '当前版本', '更新时间', '操作'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{skills.length ? skills.map((skill) => <TableRow key={skill.id}><TableCell>{skill.name}</TableCell><TableCell>{skill.code}</TableCell><TableCell>{skill.stage}</TableCell><TableCell>{skill.category}</TableCell><TableCell><StatusBadge status={skill.status} /></TableCell><TableCell>{skill.versions?.[0]?.version ? `v${skill.versions[0].version}` : '未激活'}</TableCell><TableCell>{new Date(skill.updatedAt).toLocaleString()}</TableCell><TableCell><div className="flex gap-2"><Button size="sm" variant="outline" asChild><Link href={`/admin/thesis-skills/${skill.id}`}>详情</Link></Button><Button size="sm" variant="outline" onClick={() => { setEditingId(skill.id); setDraft({ name: skill.name, code: skill.code, description: skill.description ?? '', stage: skill.stage, category: skill.category, status: skill.status, sortOrder: String(skill.sortOrder) }); }}>编辑</Button><Button size="sm" variant={skill.status === 'ENABLED' ? 'destructive' : 'outline'} onClick={() => void toggleSkill(skill)}>{skill.status === 'ENABLED' ? '禁用' : '启用'}</Button></div></TableCell></TableRow>) : <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">暂无 Skill</TableCell></TableRow>}</TableBody></Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ThesisSkillDetailPage({ skillId }: { skillId: string }) {
  const [skill, setSkill] = useState<ThesisSkill | null>(null);
  const [versions, setVersions] = useState<ThesisSkillVersion[]>([]);
  const [bindings, setBindings] = useState<ThesisSkillBinding[]>([]);
  const [runs, setRuns] = useState<ThesisSkillRun[]>([]);
  const [schools, setSchools] = useState<AcademicSchool[]>([]);
  const [majors, setMajors] = useState<AcademicMajor[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineTree>({ categories: [], levelOnes: [], levelTwos: [] });
  const [versionDraft, setVersionDraft] = useState<VersionDraft>(EMPTY_VERSION);
  const [bindingDraft, setBindingDraft] = useState<BindingDraft>(EMPTY_BINDING);
  const [testDraft, setTestDraft] = useState<TestDraft>(EMPTY_TEST);
  const [testResult, setTestResult] = useState<ThesisSkillRun | null>(null);

  async function refresh() {
    const [detail, versionList, bindingList, runPage, schoolPage, disciplineTree] = await Promise.all([
      thesisSkillApi.detail(skillId),
      thesisSkillApi.versions(skillId),
      thesisSkillApi.bindings(skillId),
      thesisSkillApi.runs({ skillId, pageSize: 20 }),
      academicApi.schools({ pageSize: 100 }),
      academicApi.disciplines(),
    ]);
    setSkill(detail);
    setVersions(versionList);
    setBindings(bindingList);
    setRuns(runPage.list);
    setSchools(schoolPage.list);
    setDisciplines(disciplineTree);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId]);
  useEffect(() => {
    if (!bindingDraft.schoolId) { setMajors([]); return; }
    void academicApi.majors({ schoolId: bindingDraft.schoolId, pageSize: 100 }).then((data) => setMajors(data.list)).catch(() => setMajors([]));
  }, [bindingDraft.schoolId]);

  const filteredLevelOnes = useMemo(() => disciplines.levelOnes.filter((x) => !bindingDraft.disciplineCategoryId || x.categoryId === bindingDraft.disciplineCategoryId), [disciplines.levelOnes, bindingDraft.disciplineCategoryId]);
  const filteredLevelTwos = useMemo(() => disciplines.levelTwos.filter((x) => !bindingDraft.disciplineLevelOneId || x.levelOneId === bindingDraft.disciplineLevelOneId), [disciplines.levelTwos, bindingDraft.disciplineLevelOneId]);

  async function saveVersion() {
    try {
      const body = {
        version: versionDraft.version ? Number(versionDraft.version) : undefined,
        promptTemplate: versionDraft.promptTemplate,
        inputSchema: parseJson(versionDraft.inputSchema, 'inputSchema'),
        outputSchema: parseJson(versionDraft.outputSchema, 'outputSchema'),
        qualityRules: parseJson(versionDraft.qualityRules, 'qualityRules'),
        modelConfig: parseJson(versionDraft.modelConfig, 'modelConfig'),
        isActive: versionDraft.isActive,
        changeLog: versionDraft.changeLog,
      };
      await thesisSkillApi.createVersion(skillId, body);
      toast.success('版本已创建');
      setVersionDraft(EMPTY_VERSION);
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存版本失败');
    }
  }

  async function saveBinding() {
    await thesisSkillApi.createBinding(skillId, { ...bindingDraft, priority: Number(bindingDraft.priority || 0) });
    toast.success('适用范围已创建');
    setBindingDraft(EMPTY_BINDING);
    await refresh();
  }

  async function runTest() {
    const run = await thesisSkillApi.testRun(skillId, {
      stage: skill?.stage,
      educationLevel: testDraft.educationLevel,
      thesisType: testDraft.thesisType,
      inputPayload: testDraft,
    });
    setTestResult(run);
    toast.success('测试运行完成');
    await refresh();
  }

  if (!skill) return <div className="p-6 text-sm text-muted-foreground">加载 Skill 详情...</div>;

  return (
    <div className="space-y-6 p-6">
      <div><h1 className="text-2xl font-semibold">{skill.name}</h1><p className="text-sm text-muted-foreground">{skill.code} · {skill.stage} · {skill.category}</p></div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>版本管理</CardTitle><CardDescription>同一 Skill 同一时间只能有一个 active 版本。</CardDescription></CardHeader><CardContent className="space-y-4"><Field label="版本号（留空自动 +1）"><Input value={versionDraft.version} onChange={(e) => setVersionDraft({ ...versionDraft, version: e.target.value })} /></Field><Field label="Prompt 模板"><Textarea className="min-h-40" value={versionDraft.promptTemplate} onChange={(e) => setVersionDraft({ ...versionDraft, promptTemplate: e.target.value })} /></Field><Field label="inputSchema JSON"><Textarea value={versionDraft.inputSchema} onChange={(e) => setVersionDraft({ ...versionDraft, inputSchema: e.target.value })} /></Field><Field label="outputSchema JSON"><Textarea value={versionDraft.outputSchema} onChange={(e) => setVersionDraft({ ...versionDraft, outputSchema: e.target.value })} /></Field><Field label="qualityRules JSON"><Textarea value={versionDraft.qualityRules} onChange={(e) => setVersionDraft({ ...versionDraft, qualityRules: e.target.value })} /></Field><Field label="modelConfig JSON"><Textarea value={versionDraft.modelConfig} onChange={(e) => setVersionDraft({ ...versionDraft, modelConfig: e.target.value })} /></Field><Field label="变更说明"><Input value={versionDraft.changeLog} onChange={(e) => setVersionDraft({ ...versionDraft, changeLog: e.target.value })} /></Field><Button onClick={() => void saveVersion()}>新建版本</Button><VersionTable versions={versions} onActivate={async (id) => { await thesisSkillApi.activateVersion(id); toast.success('版本已激活'); await refresh(); }} /></CardContent></Card>

        <Card><CardHeader><CardTitle>适用范围绑定</CardTitle><CardDescription>空值表示通用，priority 越高越优先。</CardDescription></CardHeader><CardContent className="space-y-4"><Field label="指定版本"><NativeSelect value={bindingDraft.skillVersionId} onChange={(e) => setBindingDraft({ ...bindingDraft, skillVersionId: e.target.value })}><option value="">使用当前 active 版本</option>{versions.map((v) => <option key={v.id} value={v.id}>v{v.version}{v.isActive ? '（active）' : ''}</option>)}</NativeSelect></Field><Field label="学历层次"><Input value={bindingDraft.educationLevel} onChange={(e) => setBindingDraft({ ...bindingDraft, educationLevel: e.target.value })} placeholder="UNDERGRADUATE" /></Field><Field label="论文类型"><Input value={bindingDraft.thesisType} onChange={(e) => setBindingDraft({ ...bindingDraft, thesisType: e.target.value })} placeholder="UNDERGRAD_THESIS" /></Field><Field label="学校"><NativeSelect value={bindingDraft.schoolId} onChange={(e) => setBindingDraft({ ...bindingDraft, schoolId: e.target.value, majorId: '' })}><option value="">通用</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></Field><Field label="专业"><NativeSelect value={bindingDraft.majorId} onChange={(e) => setBindingDraft({ ...bindingDraft, majorId: e.target.value })}><option value="">通用</option>{majors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</NativeSelect></Field><Field label="学科门类"><NativeSelect value={bindingDraft.disciplineCategoryId} onChange={(e) => setBindingDraft({ ...bindingDraft, disciplineCategoryId: e.target.value, disciplineLevelOneId: '', disciplineLevelTwoId: '' })}><option value="">通用</option>{disciplines.categories.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect></Field><Field label="一级学科"><NativeSelect value={bindingDraft.disciplineLevelOneId} onChange={(e) => setBindingDraft({ ...bindingDraft, disciplineLevelOneId: e.target.value, disciplineLevelTwoId: '' })}><option value="">通用</option>{filteredLevelOnes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect></Field><Field label="二级学科"><NativeSelect value={bindingDraft.disciplineLevelTwoId} onChange={(e) => setBindingDraft({ ...bindingDraft, disciplineLevelTwoId: e.target.value })}><option value="">通用</option>{filteredLevelTwos.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect></Field><Field label="priority"><Input value={bindingDraft.priority} onChange={(e) => setBindingDraft({ ...bindingDraft, priority: e.target.value })} /></Field><Button onClick={() => void saveBinding()}>新增绑定</Button><BindingList bindings={bindings} onDisable={async (id) => { await thesisSkillApi.disableBinding(id); toast.success('绑定已禁用'); await refresh(); }} /></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>测试运行</CardTitle><CardDescription>首期为 mock-preview：合成 resolvedPrompt 并写入 ThesisSkillRun，后续可接入真实模型。</CardDescription></CardHeader><CardContent className="grid gap-4 lg:grid-cols-2"><div className="space-y-3"><Field label="任务标题"><Input value={testDraft.taskTitle} onChange={(e) => setTestDraft({ ...testDraft, taskTitle: e.target.value })} /></Field><Field label="学校"><Input value={testDraft.schoolName} onChange={(e) => setTestDraft({ ...testDraft, schoolName: e.target.value })} /></Field><Field label="学院"><Input value={testDraft.collegeName} onChange={(e) => setTestDraft({ ...testDraft, collegeName: e.target.value })} /></Field><Field label="专业"><Input value={testDraft.majorName} onChange={(e) => setTestDraft({ ...testDraft, majorName: e.target.value })} /></Field><Field label="学历层次"><Input value={testDraft.educationLevel} onChange={(e) => setTestDraft({ ...testDraft, educationLevel: e.target.value })} /></Field><Field label="论文类型"><Input value={testDraft.thesisType} onChange={(e) => setTestDraft({ ...testDraft, thesisType: e.target.value })} /></Field><Field label="研究方向"><Input value={testDraft.researchDirection} onChange={(e) => setTestDraft({ ...testDraft, researchDirection: e.target.value })} /></Field><Field label="导师要求"><Textarea value={testDraft.advisorRequirement} onChange={(e) => setTestDraft({ ...testDraft, advisorRequirement: e.target.value })} /></Field><Field label="用户补充要求"><Textarea value={testDraft.userRequirement} onChange={(e) => setTestDraft({ ...testDraft, userRequirement: e.target.value })} /></Field><Button onClick={() => void runTest()}><FlaskConical className="mr-2 size-4" />测试运行</Button></div><pre className="max-h-[720px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-50">{testResult ? pretty(testResult) : '暂无测试结果'}</pre></CardContent></Card>

      <Card><CardHeader><CardTitle>最近运行记录</CardTitle></CardHeader><CardContent><RunTable runs={runs} /></CardContent></Card>
    </div>
  );
}

function VersionTable({ versions, onActivate }: { versions: ThesisSkillVersion[]; onActivate: (id: string) => void }) {
  return <Table><TableHeader><TableRow><TableHead>版本</TableHead><TableHead>状态</TableHead><TableHead>说明</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>{versions.map((v) => <TableRow key={v.id}><TableCell>v{v.version}</TableCell><TableCell>{v.isActive ? 'active' : '-'}</TableCell><TableCell>{v.changeLog ?? '-'}</TableCell><TableCell><Button size="sm" variant="outline" disabled={v.isActive} onClick={() => onActivate(v.id)}>激活</Button></TableCell></TableRow>)}</TableBody></Table>;
}

function BindingList({ bindings, onDisable }: { bindings: ThesisSkillBinding[]; onDisable: (id: string) => void }) {
  return <div className="space-y-2">{bindings.map((b) => <div key={b.id} className="rounded-lg border p-3 text-sm"><div className="flex justify-between"><span>priority={b.priority} · {b.educationLevel || '通用学历'} · {b.thesisType || '通用类型'}</span><StatusBadge status={b.status} /></div><div className="mt-1 text-xs text-muted-foreground">{b.school?.name ?? '通用学校'} / {b.major?.name ?? '通用专业'} / {b.disciplineCategory?.name ?? '通用学科'}</div><Button className="mt-2" size="sm" variant="outline" onClick={() => onDisable(b.id)}>禁用</Button></div>)}</div>;
}

function RunTable({ runs }: { runs: ThesisSkillRun[] }) {
  return <Table><TableHeader><TableRow>{['Skill', '阶段', '状态', '模型', '开始时间', '详情'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{runs.length ? runs.map((run) => <TableRow key={run.id}><TableCell>{run.skill?.name ?? run.skillId}</TableCell><TableCell>{run.stage}</TableCell><TableCell><StatusBadge status={run.status} /></TableCell><TableCell>{run.modelName ?? '-'}</TableCell><TableCell>{run.startedAt ? new Date(run.startedAt).toLocaleString() : '-'}</TableCell><TableCell><details><summary className="cursor-pointer text-primary">查看</summary><pre className="mt-2 max-w-xl overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-50">{pretty(run)}</pre></details></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">暂无运行记录</TableCell></TableRow>}</TableBody></Table>;
}

export function ThesisSkillRunsPage() {
  const [runs, setRuns] = useState<ThesisSkillRun[]>([]);
  const [skills, setSkills] = useState<ThesisSkill[]>([]);
  const [skillId, setSkillId] = useState('');
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('');

  async function refresh() {
    const [runPage, skillPage] = await Promise.all([
      thesisSkillApi.runs({ skillId: skillId || undefined, stage: stage || undefined, status: status || undefined, pageSize: 100 }),
      thesisSkillApi.list({ pageSize: 100 }),
    ]);
    setRuns(runPage.list);
    setSkills(skillPage.list);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="space-y-6 p-6"><div><h1 className="text-2xl font-semibold">Skill 运行记录</h1><p className="text-sm text-muted-foreground">查看测试运行和后续真实生成运行记录。</p></div><Card><CardHeader><CardTitle>筛选</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-4"><NativeSelect value={skillId} onChange={(e) => setSkillId(e.target.value)}><option value="">全部 Skill</option>{skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect><NativeSelect value={stage} onChange={(e) => setStage(e.target.value)}><option value="">全部阶段</option>{STAGES.map((x) => <option key={x}>{x}</option>)}</NativeSelect><NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="">全部状态</option>{['PENDING', 'RUNNING', 'SUCCESS', 'FAILED'].map((x) => <option key={x}>{x}</option>)}</NativeSelect><Button onClick={() => void refresh()}>查询</Button></CardContent></Card><Card><CardHeader><CardTitle>记录列表</CardTitle></CardHeader><CardContent><RunTable runs={runs} /></CardContent></Card></div>;
}
