'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BookOpen, Building2, DatabaseZap, GraduationCap, Layers3, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { academicApi } from '@/services/admin/academic';
import { SchoolImportDialog } from './school-import-dialog';
import { CatalogImportDialog } from './catalog-import-dialog';
import { CollegeDataPanel } from './college-data-panel';
import type {
  AcademicCity,
  AcademicCollege,
  AcademicMajor,
  AcademicProvince,
  AcademicSchool,
  AcademicStatus,
  DisciplineTree,
} from '@/types/admin/academic';

type Mode = 'schools' | 'colleges' | 'majors' | 'disciplines';

type SchoolDraft = {
  provinceId: string;
  cityId: string;
  name: string;
  code: string;
  schoolType: string;
  educationLevels: string;
  status: AcademicStatus;
  sortOrder: string;
  remark: string;
};

type CollegeDraft = {
  schoolId: string;
  name: string;
  code: string;
  status: AcademicStatus;
  sortOrder: string;
  remark: string;
};

type MajorDraft = {
  schoolId: string;
  collegeId: string;
  disciplineCategoryId: string;
  disciplineLevelOneId: string;
  disciplineLevelTwoId: string;
  name: string;
  code: string;
  educationLevel: string;
  status: AcademicStatus;
  sortOrder: string;
  remark: string;
};

type NodeDraft = {
  parentId: string;
  name: string;
  code: string;
  status: AcademicStatus;
  sortOrder: string;
};

const NAV = [
  { href: '/admin/academic/schools', label: '高校管理', mode: 'schools', icon: Building2 },
  { href: '/admin/academic/colleges', label: '学院管理', mode: 'colleges', icon: Layers3 },
  { href: '/admin/academic/majors', label: '专业管理', mode: 'majors', icon: GraduationCap },
  { href: '/admin/academic/disciplines', label: '学科目录', mode: 'disciplines', icon: BookOpen },
  { href: '/admin/academic/sync', label: '数据同步', mode: 'sync', icon: DatabaseZap },
] as const;

const EMPTY_SCHOOL: SchoolDraft = {
  provinceId: '',
  cityId: '',
  name: '',
  code: '',
  schoolType: '',
  educationLevels: 'UNDERGRADUATE',
  status: 'ACTIVE',
  sortOrder: '0',
  remark: '',
};
const EMPTY_COLLEGE: CollegeDraft = { schoolId: '', name: '', code: '', status: 'ACTIVE', sortOrder: '0', remark: '' };
const EMPTY_MAJOR: MajorDraft = {
  schoolId: '',
  collegeId: '',
  disciplineCategoryId: '',
  disciplineLevelOneId: '',
  disciplineLevelTwoId: '',
  name: '',
  code: '',
  educationLevel: 'UNDERGRADUATE',
  status: 'ACTIVE',
  sortOrder: '0',
  remark: '',
};
const EMPTY_NODE: NodeDraft = { parentId: '', name: '', code: '', status: 'ACTIVE', sortOrder: '0' };

function StatusBadge({ status }: { status: AcademicStatus }) {
  return (
    <span className={status === 'ACTIVE' ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700' : 'rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500'}>
      {status === 'ACTIVE' ? '启用' : '禁用'}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs ${props.className ?? ''}`} />;
}

function toSortOrder(v: string) {
  const n = Number(v || '0');
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function splitLevels(v: string) {
  return v.split(',').map((x) => x.trim()).filter(Boolean);
}

export function AcademicAdminPage({ mode }: { mode: Mode }) {
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [provinces, setProvinces] = useState<AcademicProvince[]>([]);
  const [cities, setCities] = useState<AcademicCity[]>([]);
  const [schools, setSchools] = useState<AcademicSchool[]>([]);
  const [colleges, setColleges] = useState<AcademicCollege[]>([]);
  const [majors, setMajors] = useState<AcademicMajor[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineTree>({ categories: [], levelOnes: [], levelTwos: [] });

  const [schoolDraft, setSchoolDraft] = useState<SchoolDraft>(EMPTY_SCHOOL);
  const [collegeDraft, setCollegeDraft] = useState<CollegeDraft>(EMPTY_COLLEGE);
  const [majorDraft, setMajorDraft] = useState<MajorDraft>(EMPTY_MAJOR);
  const [categoryDraft, setCategoryDraft] = useState<NodeDraft>(EMPTY_NODE);
  const [levelOneDraft, setLevelOneDraft] = useState<NodeDraft>(EMPTY_NODE);
  const [levelTwoDraft, setLevelTwoDraft] = useState<NodeDraft>(EMPTY_NODE);

  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [editingCollegeId, setEditingCollegeId] = useState<string | null>(null);
  const [editingMajorId, setEditingMajorId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<{ type: 'category' | 'levelOne' | 'levelTwo'; id: string } | null>(null);

  async function loadLookups() {
    const [provinceList, schoolPage, disciplineTree] = await Promise.all([
      academicApi.provinces(),
      academicApi.schools({ pageSize: 100 }),
      academicApi.disciplines(),
    ]);
    setProvinces(provinceList);
    setSchools(schoolPage.list);
    setDisciplines(disciplineTree);
  }

  async function refresh() {
    setLoading(true);
    try {
      await loadLookups();
      if (mode === 'schools') {
        const data = await academicApi.schools({ keyword, pageSize: 100 });
        setSchools(data.list);
      } else if (mode === 'colleges') {
        const data = await academicApi.colleges({ schoolId: collegeDraft.schoolId || undefined, keyword, pageSize: 100 });
        setColleges(data.list);
      } else if (mode === 'majors') {
        const data = await academicApi.majors({ schoolId: majorDraft.schoolId || undefined, collegeId: majorDraft.collegeId || undefined, educationLevel: majorDraft.educationLevel || undefined, keyword, pageSize: 100 });
        setMajors(data.list);
      } else {
        setDisciplines(await academicApi.disciplines());
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载学术基础数据失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (!schoolDraft.provinceId) {
      setCities([]);
      return;
    }
    void academicApi.cities(schoolDraft.provinceId).then(setCities).catch(() => setCities([]));
  }, [schoolDraft.provinceId]);

  useEffect(() => {
    if (!collegeDraft.schoolId && !majorDraft.schoolId) return;
    const schoolId = collegeDraft.schoolId || majorDraft.schoolId;
    void academicApi.publicColleges(schoolId).then((data) => setColleges(data.list)).catch(() => setColleges([]));
  }, [collegeDraft.schoolId, majorDraft.schoolId]);

  const levelOnes = useMemo(() => disciplines.levelOnes.filter((x) => !majorDraft.disciplineCategoryId || x.categoryId === majorDraft.disciplineCategoryId), [disciplines.levelOnes, majorDraft.disciplineCategoryId]);
  const levelTwos = useMemo(() => disciplines.levelTwos.filter((x) => !majorDraft.disciplineLevelOneId || x.levelOneId === majorDraft.disciplineLevelOneId), [disciplines.levelTwos, majorDraft.disciplineLevelOneId]);

  async function saveSchool() {
    if (!schoolDraft.provinceId || !schoolDraft.cityId || !schoolDraft.name.trim()) {
      toast.error('请选择省份、城市并填写高校名称');
      return;
    }
    const body = { ...schoolDraft, sortOrder: toSortOrder(schoolDraft.sortOrder), educationLevels: splitLevels(schoolDraft.educationLevels) };
    if (editingSchoolId) await academicApi.updateSchool(editingSchoolId, body);
    else await academicApi.createSchool(body);
    toast.success(editingSchoolId ? '高校已更新' : '高校已新增');
    setSchoolDraft(EMPTY_SCHOOL);
    setEditingSchoolId(null);
    await refresh();
  }

  async function saveCollege() {
    if (!collegeDraft.schoolId || !collegeDraft.name.trim()) {
      toast.error('请选择高校并填写学院名称');
      return;
    }
    const body = { ...collegeDraft, sortOrder: toSortOrder(collegeDraft.sortOrder) };
    if (editingCollegeId) await academicApi.updateCollege(editingCollegeId, body);
    else await academicApi.createCollege(body);
    toast.success(editingCollegeId ? '学院已更新' : '学院已新增');
    setCollegeDraft(EMPTY_COLLEGE);
    setEditingCollegeId(null);
    await refresh();
  }

  async function saveMajor() {
    if (!majorDraft.schoolId || !majorDraft.name.trim()) {
      toast.error('请选择高校并填写专业名称');
      return;
    }
    const body = { ...majorDraft, sortOrder: toSortOrder(majorDraft.sortOrder) };
    if (editingMajorId) await academicApi.updateMajor(editingMajorId, body);
    else await academicApi.createMajor(body);
    toast.success(editingMajorId ? '专业已更新' : '专业已新增');
    setMajorDraft(EMPTY_MAJOR);
    setEditingMajorId(null);
    await refresh();
  }

  async function saveNode(type: 'category' | 'levelOne' | 'levelTwo') {
    const draft = type === 'category' ? categoryDraft : type === 'levelOne' ? levelOneDraft : levelTwoDraft;
    if (!draft.name.trim() || !draft.code.trim()) {
      toast.error('请填写名称和编码');
      return;
    }
    if (type !== 'category' && !draft.parentId) {
      toast.error(type === 'levelOne' ? '请选择学科门类' : '请选择一级学科');
      return;
    }
    const body = { name: draft.name, code: draft.code, status: draft.status, sortOrder: toSortOrder(draft.sortOrder), categoryId: draft.parentId, levelOneId: draft.parentId };
    if (editingNode?.type === type) {
      if (type === 'category') await academicApi.updateCategory(editingNode.id, body);
      if (type === 'levelOne') await academicApi.updateLevelOne(editingNode.id, body);
      if (type === 'levelTwo') await academicApi.updateLevelTwo(editingNode.id, body);
      toast.success('学科目录已更新');
    } else {
      if (type === 'category') await academicApi.createCategory(body);
      if (type === 'levelOne') await academicApi.createLevelOne(body);
      if (type === 'levelTwo') await academicApi.createLevelTwo(body);
      toast.success('学科目录已新增');
    }
    setCategoryDraft(EMPTY_NODE);
    setLevelOneDraft(EMPTY_NODE);
    setLevelTwoDraft(EMPTY_NODE);
    setEditingNode(null);
    await refresh();
  }

  async function toggleStatus(kind: 'school' | 'college' | 'major' | 'category' | 'levelOne' | 'levelTwo', id: string, current: AcademicStatus) {
    if (current === 'ACTIVE') {
      if (kind === 'school') await academicApi.disableSchool(id);
      if (kind === 'college') await academicApi.disableCollege(id);
      if (kind === 'major') await academicApi.disableMajor(id);
      if (kind === 'category') await academicApi.disableCategory(id);
      if (kind === 'levelOne') await academicApi.disableLevelOne(id);
      if (kind === 'levelTwo') await academicApi.disableLevelTwo(id);
    } else {
      const body = { status: 'ACTIVE' };
      if (kind === 'school') await academicApi.updateSchool(id, body);
      if (kind === 'college') await academicApi.updateCollege(id, body);
      if (kind === 'major') await academicApi.updateMajor(id, body);
      if (kind === 'category') await academicApi.updateCategory(id, body);
      if (kind === 'levelOne') await academicApi.updateLevelOne(id, body);
      if (kind === 'levelTwo') await academicApi.updateLevelTwo(id, body);
    }
    toast.success(current === 'ACTIVE' ? '已禁用' : '已启用');
    await refresh();
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-semibold">学术基础数据</h1>
          <p className="text-sm text-muted-foreground">维护地区、高校、学院、专业与学科目录，为后续论文任务、Skill 和格式模板提供统一上下文。</p>
        </div>
        <div className="flex gap-2">
          {mode === 'schools' ? <SchoolImportDialog onImported={() => void refresh()} /> : null}
          {mode === 'majors' ? <CatalogImportDialog kind="major" onImported={() => void refresh()} /> : null}
          {mode === 'disciplines' ? <CatalogImportDialog kind="discipline" onImported={() => void refresh()} /> : null}
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className="mr-2 size-4" /> 刷新
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.mode === mode;
          return (
            <Link key={item.href} href={item.href} className={active ? 'rounded-xl border bg-primary p-4 text-primary-foreground shadow-sm' : 'rounded-xl border bg-card p-4 text-card-foreground shadow-sm hover:bg-muted/50'}>
              <div className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4" /> {item.label}</div>
            </Link>
          );
        })}
      </div>

      {mode === 'colleges' ? <CollegeDataPanel onImported={() => void refresh()} /> : null}

      {mode !== 'disciplines' ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-end">
          <Field label="关键词"><Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="名称 / 编码" /></Field>
          <Button onClick={() => void refresh()} disabled={loading}>搜索</Button>
        </div>
      ) : null}

      {mode === 'schools' ? renderSchools() : null}
      {mode === 'colleges' ? renderColleges() : null}
      {mode === 'majors' ? renderMajors() : null}
      {mode === 'disciplines' ? renderDisciplines() : null}
    </div>
  );

  function renderSchools() {
    return (
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>{editingSchoolId ? '编辑高校' : '新增高校'}</CardTitle><CardDescription>省份、城市来自公开查询 API。</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Field label="省份"><NativeSelect value={schoolDraft.provinceId} onChange={(e) => setSchoolDraft({ ...schoolDraft, provinceId: e.target.value, cityId: '' })}><option value="">请选择</option>{provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></Field>
            <Field label="城市"><NativeSelect value={schoolDraft.cityId} onChange={(e) => setSchoolDraft({ ...schoolDraft, cityId: e.target.value })}><option value="">请选择</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
            <Field label="高校名称"><Input value={schoolDraft.name} onChange={(e) => setSchoolDraft({ ...schoolDraft, name: e.target.value })} /></Field>
            <Field label="编码"><Input value={schoolDraft.code} onChange={(e) => setSchoolDraft({ ...schoolDraft, code: e.target.value })} /></Field>
            <Field label="学校类型"><Input value={schoolDraft.schoolType} onChange={(e) => setSchoolDraft({ ...schoolDraft, schoolType: e.target.value })} placeholder="NORMAL / VOCATIONAL" /></Field>
            <Field label="学历层次（逗号分隔）"><Input value={schoolDraft.educationLevels} onChange={(e) => setSchoolDraft({ ...schoolDraft, educationLevels: e.target.value })} /></Field>
            <Field label="状态"><NativeSelect value={schoolDraft.status} onChange={(e) => setSchoolDraft({ ...schoolDraft, status: e.target.value as AcademicStatus })}><option value="ACTIVE">启用</option><option value="INACTIVE">禁用</option></NativeSelect></Field>
            <Field label="排序"><Input value={schoolDraft.sortOrder} onChange={(e) => setSchoolDraft({ ...schoolDraft, sortOrder: e.target.value })} /></Field>
            <Field label="备注"><Textarea value={schoolDraft.remark} onChange={(e) => setSchoolDraft({ ...schoolDraft, remark: e.target.value })} /></Field>
            <Button className="w-full" onClick={() => void saveSchool()}><Plus className="mr-2 size-4" />保存高校</Button>
          </CardContent>
        </Card>
        <AcademicTable headers={['高校', '地区', '类型/学历', '状态', '操作']} rows={schools.map((s) => [s.name, `${s.province?.name ?? '-'} / ${s.city?.name ?? '-'}`, `${s.schoolType ?? '-'} / ${s.educationLevels?.join(',') || '-'}`, <StatusBadge key="status" status={s.status} />, <RowActions key="actions" onEdit={() => { setEditingSchoolId(s.id); setSchoolDraft({ provinceId: s.provinceId, cityId: s.cityId, name: s.name, code: s.code ?? '', schoolType: s.schoolType ?? '', educationLevels: s.educationLevels?.join(',') ?? '', status: s.status, sortOrder: String(s.sortOrder), remark: s.remark ?? '' }); }} onToggle={() => void toggleStatus('school', s.id, s.status)} status={s.status} />])} />
      </div>
    );
  }

  function renderColleges() {
    return (
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>{editingCollegeId ? '编辑学院' : '新增学院'}</CardTitle><CardDescription>学院归属到高校，用于专业联动。</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <SchoolSelect value={collegeDraft.schoolId} onChange={(schoolId) => setCollegeDraft({ ...collegeDraft, schoolId })} />
            <Field label="学院名称"><Input value={collegeDraft.name} onChange={(e) => setCollegeDraft({ ...collegeDraft, name: e.target.value })} /></Field>
            <Field label="编码"><Input value={collegeDraft.code} onChange={(e) => setCollegeDraft({ ...collegeDraft, code: e.target.value })} /></Field>
            <Field label="状态"><NativeSelect value={collegeDraft.status} onChange={(e) => setCollegeDraft({ ...collegeDraft, status: e.target.value as AcademicStatus })}><option value="ACTIVE">启用</option><option value="INACTIVE">禁用</option></NativeSelect></Field>
            <Field label="排序"><Input value={collegeDraft.sortOrder} onChange={(e) => setCollegeDraft({ ...collegeDraft, sortOrder: e.target.value })} /></Field>
            <Field label="备注"><Textarea value={collegeDraft.remark} onChange={(e) => setCollegeDraft({ ...collegeDraft, remark: e.target.value })} /></Field>
            <Button className="w-full" onClick={() => void saveCollege()}>保存学院</Button>
          </CardContent>
        </Card>
        <AcademicTable headers={['学院', '高校', '状态', '操作']} rows={colleges.map((c) => [c.name, c.school?.name ?? '-', <StatusBadge key="status" status={c.status} />, <RowActions key="actions" onEdit={() => { setEditingCollegeId(c.id); setCollegeDraft({ schoolId: c.schoolId, name: c.name, code: c.code ?? '', status: c.status, sortOrder: String(c.sortOrder), remark: c.remark ?? '' }); }} onToggle={() => void toggleStatus('college', c.id, c.status)} status={c.status} />])} />
      </div>
    );
  }

  function renderMajors() {
    return (
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader><CardTitle>{editingMajorId ? '编辑专业' : '新增专业'}</CardTitle><CardDescription>专业可绑定学科门类、一级学科、二级学科。</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <SchoolSelect value={majorDraft.schoolId} onChange={(schoolId) => setMajorDraft({ ...majorDraft, schoolId, collegeId: '' })} />
            <Field label="学院"><NativeSelect value={majorDraft.collegeId} onChange={(e) => setMajorDraft({ ...majorDraft, collegeId: e.target.value })}><option value="">不绑定学院</option>{colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
            <Field label="专业名称"><Input value={majorDraft.name} onChange={(e) => setMajorDraft({ ...majorDraft, name: e.target.value })} /></Field>
            <Field label="专业编码"><Input value={majorDraft.code} onChange={(e) => setMajorDraft({ ...majorDraft, code: e.target.value })} /></Field>
            <Field label="学历层次"><Input value={majorDraft.educationLevel} onChange={(e) => setMajorDraft({ ...majorDraft, educationLevel: e.target.value })} /></Field>
            <Field label="学科门类"><NativeSelect value={majorDraft.disciplineCategoryId} onChange={(e) => setMajorDraft({ ...majorDraft, disciplineCategoryId: e.target.value, disciplineLevelOneId: '', disciplineLevelTwoId: '' })}><option value="">请选择</option>{disciplines.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
            <Field label="一级学科"><NativeSelect value={majorDraft.disciplineLevelOneId} onChange={(e) => setMajorDraft({ ...majorDraft, disciplineLevelOneId: e.target.value, disciplineLevelTwoId: '' })}><option value="">请选择</option>{levelOnes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</NativeSelect></Field>
            <Field label="二级学科 / 专业"><NativeSelect value={majorDraft.disciplineLevelTwoId} onChange={(e) => setMajorDraft({ ...majorDraft, disciplineLevelTwoId: e.target.value })}><option value="">请选择</option>{levelTwos.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</NativeSelect></Field>
            <Field label="状态"><NativeSelect value={majorDraft.status} onChange={(e) => setMajorDraft({ ...majorDraft, status: e.target.value as AcademicStatus })}><option value="ACTIVE">启用</option><option value="INACTIVE">禁用</option></NativeSelect></Field>
            <Field label="排序"><Input value={majorDraft.sortOrder} onChange={(e) => setMajorDraft({ ...majorDraft, sortOrder: e.target.value })} /></Field>
            <Field label="备注"><Textarea value={majorDraft.remark} onChange={(e) => setMajorDraft({ ...majorDraft, remark: e.target.value })} /></Field>
            <Button className="w-full" onClick={() => void saveMajor()}>保存专业</Button>
          </CardContent>
        </Card>
        <AcademicTable headers={['专业', '高校/学院', '学科', '学历', '状态', '操作']} rows={majors.map((m) => [m.name, `${m.school?.name ?? '-'} / ${m.college?.name ?? '未绑定'}`, `${m.disciplineCategory?.name ?? '-'} / ${m.disciplineLevelOne?.name ?? '-'} / ${m.disciplineLevelTwo?.name ?? '-'}`, m.educationLevel ?? '-', <StatusBadge key="status" status={m.status} />, <RowActions key="actions" onEdit={() => { setEditingMajorId(m.id); setMajorDraft({ schoolId: m.schoolId, collegeId: m.collegeId ?? '', disciplineCategoryId: m.disciplineCategoryId ?? '', disciplineLevelOneId: m.disciplineLevelOneId ?? '', disciplineLevelTwoId: m.disciplineLevelTwoId ?? '', name: m.name, code: m.code ?? '', educationLevel: m.educationLevel ?? '', status: m.status, sortOrder: String(m.sortOrder), remark: m.remark ?? '' }); }} onToggle={() => void toggleStatus('major', m.id, m.status)} status={m.status} />])} />
      </div>
    );
  }

  function renderDisciplines() {
    return (
      <div className="grid gap-6 xl:grid-cols-3">
        <DisciplineCard title="学科门类" draft={categoryDraft} setDraft={setCategoryDraft} onSave={() => void saveNode('category')} rows={disciplines.categories.map((x) => ({ id: x.id, name: x.name, code: x.code, status: x.status, sortOrder: x.sortOrder }))} onEdit={(x) => { setEditingNode({ type: 'category', id: x.id }); setCategoryDraft({ parentId: '', name: x.name, code: x.code, status: x.status, sortOrder: String(x.sortOrder) }); }} onToggle={(x) => void toggleStatus('category', x.id, x.status)} />
        <DisciplineCard title="一级学科" parentLabel="学科门类" parents={disciplines.categories} draft={levelOneDraft} setDraft={setLevelOneDraft} onSave={() => void saveNode('levelOne')} rows={disciplines.levelOnes.map((x) => ({ id: x.id, name: x.name, code: x.code, status: x.status, sortOrder: x.sortOrder, parentName: x.category?.name }))} onEdit={(x) => { const src = disciplines.levelOnes.find((i) => i.id === x.id); setEditingNode({ type: 'levelOne', id: x.id }); setLevelOneDraft({ parentId: src?.categoryId ?? '', name: x.name, code: x.code, status: x.status, sortOrder: String(x.sortOrder) }); }} onToggle={(x) => void toggleStatus('levelOne', x.id, x.status)} />
        <DisciplineCard title="二级学科 / 专业" parentLabel="一级学科" parents={disciplines.levelOnes} draft={levelTwoDraft} setDraft={setLevelTwoDraft} onSave={() => void saveNode('levelTwo')} rows={disciplines.levelTwos.map((x) => ({ id: x.id, name: x.name, code: x.code, status: x.status, sortOrder: x.sortOrder, parentName: x.levelOne?.name }))} onEdit={(x) => { const src = disciplines.levelTwos.find((i) => i.id === x.id); setEditingNode({ type: 'levelTwo', id: x.id }); setLevelTwoDraft({ parentId: src?.levelOneId ?? '', name: x.name, code: x.code, status: x.status, sortOrder: String(x.sortOrder) }); }} onToggle={(x) => void toggleStatus('levelTwo', x.id, x.status)} />
      </div>
    );
  }

  function SchoolSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return <Field label="高校"><NativeSelect value={value} onChange={(e) => onChange(e.target.value)}><option value="">请选择高校</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></Field>;
  }
}

function RowActions({ status, onEdit, onToggle }: { status: AcademicStatus; onEdit: () => void; onToggle: () => void }) {
  return <div className="flex gap-2"><Button size="sm" variant="outline" onClick={onEdit}>编辑</Button><Button size="sm" variant={status === 'ACTIVE' ? 'destructive' : 'outline'} onClick={onToggle}>{status === 'ACTIVE' ? '禁用' : '启用'}</Button></div>;
}

function AcademicTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <Card>
      <CardHeader><CardTitle>数据列表</CardTitle><CardDescription>禁用为软删除，不物理删除历史基础数据。</CardDescription></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.length ? rows.map((row, i) => <TableRow key={i}>{row.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={headers.length} className="py-10 text-center text-muted-foreground">暂无数据</TableCell></TableRow>}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

type DisciplineRow = { id: string; name: string; code: string; status: AcademicStatus; sortOrder: number; parentName?: string };
function DisciplineCard({ title, parentLabel, parents = [], draft, setDraft, onSave, rows, onEdit, onToggle }: { title: string; parentLabel?: string; parents?: Array<{ id: string; name: string }>; draft: NodeDraft; setDraft: (v: NodeDraft) => void; onSave: () => void; rows: DisciplineRow[]; onEdit: (row: DisciplineRow) => void; onToggle: (row: DisciplineRow) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>支持新增、编辑、启用和禁用。</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {parentLabel ? <Field label={parentLabel}><NativeSelect value={draft.parentId} onChange={(e) => setDraft({ ...draft, parentId: e.target.value })}><option value="">请选择</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></Field> : null}
        <Field label="名称"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
        <Field label="编码"><Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></Field>
        <Field label="状态"><NativeSelect value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as AcademicStatus })}><option value="ACTIVE">启用</option><option value="INACTIVE">禁用</option></NativeSelect></Field>
        <Field label="排序"><Input value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} /></Field>
        <Button className="w-full" onClick={onSave}>保存</Button>
        <div className="space-y-2 pt-4">
          {rows.map((row) => <div key={row.id} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-2"><div><div className="font-medium">{row.name}</div><div className="text-xs text-muted-foreground">{row.parentName ? `${row.parentName} / ` : ''}{row.code}</div></div><StatusBadge status={row.status} /></div><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => onEdit(row)}>编辑</Button><Button size="sm" variant={row.status === 'ACTIVE' ? 'destructive' : 'outline'} onClick={() => onToggle(row)}>{row.status === 'ACTIVE' ? '禁用' : '启用'}</Button></div></div>)}
        </div>
      </CardContent>
    </Card>
  );
}
