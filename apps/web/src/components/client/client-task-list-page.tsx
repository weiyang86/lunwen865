'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';

type TaskItem = {
  id: string;
  title: string | null;
  major: string;
  majorName?: string | null;
  schoolName?: string | null;
  educationLevel: string;
  thesisType?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type OptionItem = { id: string; name: string; provinceId?: string; cityId?: string; schoolId?: string; collegeId?: string | null; educationLevel?: string | null; disciplineCategoryId?: string | null; disciplineLevelOneId?: string | null; disciplineLevelTwoId?: string | null };

type TaskListResponse = {
  items: TaskItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
};

type CreateTaskPayload = {
  title: string;
  major: string;
  educationLevel: string;
  topic: string;
  schoolId?: string;
  provinceId?: string;
  cityId?: string;
  academicSchoolId?: string;
  collegeId?: string;
  majorId?: string;
  disciplineCategoryId?: string;
  disciplineLevelOneId?: string;
  disciplineLevelTwoId?: string;
  thesisType?: string;
  researchDirection?: string;
  advisorRequirement?: string;
  wordCountTarget?: number;
};

const MAX_TITLE_LENGTH = 200;
const MAX_MAJOR_LENGTH = 200;
const MAX_EDUCATION_LEVEL_LENGTH = 200;
const MAX_TOPIC_LENGTH = 500;
const MIN_WORD_COUNT_TARGET = 3000;
const MAX_WORD_COUNT_TARGET = 100000;

export function buildTaskBootstrapPayload(values: CreateTaskPayload) {
  const payload: CreateTaskPayload = {
    title: values.title.trim(),
    major: values.major.trim(),
    educationLevel: values.educationLevel.trim(),
    topic: values.topic.trim(),
  };

  const trimmedSchool = values.schoolId?.trim();
  if (trimmedSchool) payload.schoolId = trimmedSchool;
  for (const key of ['provinceId', 'cityId', 'academicSchoolId', 'collegeId', 'majorId', 'disciplineCategoryId', 'disciplineLevelOneId', 'disciplineLevelTwoId', 'thesisType', 'researchDirection', 'advisorRequirement'] as const) {
    const value = values[key]?.trim();
    if (value) payload[key] = value;
  }
  if (typeof values.wordCountTarget === 'number') payload.wordCountTarget = values.wordCountTarget;

  return payload;
}

export function ClientTaskListPage() {
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TaskListResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [cityId, setCityId] = useState('');
  const [academicSchoolId, setAcademicSchoolId] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [majorId, setMajorId] = useState('');
  const [major, setMajor] = useState('');
  const [educationLevel, setEducationLevel] = useState('UNDERGRADUATE');
  const [thesisType, setThesisType] = useState('FULL_PAPER');
  const [topic, setTopic] = useState('');
  const [advisorRequirement, setAdvisorRequirement] = useState('');
  const [wordCountTarget, setWordCountTarget] = useState('8000');
  const [provinces, setProvinces] = useState<OptionItem[]>([]);
  const [cities, setCities] = useState<OptionItem[]>([]);
  const [schools, setSchools] = useState<OptionItem[]>([]);
  const [colleges, setColleges] = useState<OptionItem[]>([]);
  const [majors, setMajors] = useState<OptionItem[]>([]);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await clientHttp.get<TaskListResponse>('/tasks', {
        page,
        pageSize: 10,
      });
      setData(result);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, '加载任务列表失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    void clientHttp.get<OptionItem[]>('/academic/provinces').then(setProvinces).catch(() => setProvinces([]));
  }, []);

  useEffect(() => {
    setCityId('');
    setAcademicSchoolId('');
    setCollegeId('');
    setMajorId('');
    if (!provinceId) { setCities([]); setSchools([]); setColleges([]); setMajors([]); return; }
    void clientHttp.get<OptionItem[]>('/academic/cities', { provinceId }).then(setCities).catch(() => setCities([]));
    void clientHttp.get<{ list: OptionItem[] }>('/academic/schools', { provinceId, pageSize: 100 }).then((r) => setSchools(r.list ?? [])).catch(() => setSchools([]));
  }, [provinceId]);

  useEffect(() => {
    setAcademicSchoolId('');
    setCollegeId('');
    setMajorId('');
    if (!cityId) return;
    void clientHttp.get<{ list: OptionItem[] }>('/academic/schools', { provinceId: provinceId || undefined, cityId, pageSize: 100 }).then((r) => setSchools(r.list ?? [])).catch(() => setSchools([]));
  }, [cityId, provinceId]);

  useEffect(() => {
    setCollegeId('');
    setMajorId('');
    if (!academicSchoolId) { setColleges([]); setMajors([]); return; }
    void clientHttp.get<{ list: OptionItem[] }>('/academic/colleges', { schoolId: academicSchoolId, pageSize: 100 }).then((r) => setColleges(r.list ?? [])).catch(() => setColleges([]));
    void clientHttp.get<{ list: OptionItem[] }>('/academic/majors', { schoolId: academicSchoolId, educationLevel, pageSize: 100 }).then((r) => setMajors(r.list ?? [])).catch(() => setMajors([]));
  }, [academicSchoolId, educationLevel]);

  useEffect(() => {
    setMajorId('');
    if (!academicSchoolId) return;
    void clientHttp.get<{ list: OptionItem[] }>('/academic/majors', { schoolId: academicSchoolId, collegeId: collegeId || undefined, educationLevel, pageSize: 100 }).then((r) => setMajors(r.list ?? [])).catch(() => setMajors([]));
  }, [academicSchoolId, collegeId, educationLevel]);

  useEffect(() => {
    const selected = majors.find((item) => item.id === majorId);
    if (!selected) return;
    setMajor(selected.name);
    if (selected.educationLevel) setEducationLevel(selected.educationLevel);
  }, [majorId, majors]);

  const totalPages = data?.totalPages ?? Math.max(1, Math.ceil((data?.total || 0) / (data?.pageSize || 10)));

  const formError = useMemo(() => {
    if (!title.trim()) return '请填写论文任务标题。';
    if (title.trim().length > MAX_TITLE_LENGTH) return `任务标题不能超过 ${MAX_TITLE_LENGTH} 个字符。`;
    if (!academicSchoolId) return '请选择学校。';
    if (!majorId && !major.trim()) return '请选择或填写专业信息。';
    if (major.trim().length > MAX_MAJOR_LENGTH) return `专业信息不能超过 ${MAX_MAJOR_LENGTH} 个字符。`;
    if (!educationLevel.trim()) return '请填写学历层次。';
    if (educationLevel.trim().length > MAX_EDUCATION_LEVEL_LENGTH) return `学历层次不能超过 ${MAX_EDUCATION_LEVEL_LENGTH} 个字符。`;
    if (!topic.trim()) return '请填写论文方向或题目描述。';
    if (topic.trim().length > MAX_TOPIC_LENGTH) return `论文方向描述不能超过 ${MAX_TOPIC_LENGTH} 个字符。`;
    const wcRaw = wordCountTarget.trim();
    const wc = wcRaw ? Number(wcRaw) : NaN;
    if (!Number.isFinite(wc) || wc < MIN_WORD_COUNT_TARGET || wc > MAX_WORD_COUNT_TARGET) {
      return `请填写目标字数（${MIN_WORD_COUNT_TARGET}-${MAX_WORD_COUNT_TARGET}）。`;
    }
    return null;
  }, [title, academicSchoolId, majorId, major, educationLevel, topic, wordCountTarget]);

  const resetForm = () => {
    setTitle('');
    setProvinceId('');
    setCityId('');
    setAcademicSchoolId('');
    setCollegeId('');
    setMajorId('');
    setMajor('');
    setEducationLevel('UNDERGRADUATE');
    setThesisType('FULL_PAPER');
    setTopic('');
    setAdvisorRequirement('');
    setWordCountTarget('8000');
  };

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (formError) {
      setSubmitError(formError);
      return;
    }

    const payload = buildTaskBootstrapPayload({
      title,
      major,
      educationLevel,
      topic,
      provinceId,
      cityId,
      academicSchoolId,
      collegeId,
      majorId,
      thesisType,
      researchDirection: topic,
      advisorRequirement,
      wordCountTarget: Number(wordCountTarget.trim()),
    });

    try {
      setSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(null);
      await clientHttp.post('/tasks/bootstrap', payload);
      setSubmitSuccess('任务创建成功，已加入你的任务列表。');
      resetForm();
      setPage(1);
      await loadTasks();
    } catch (requestError: unknown) {
      setSubmitError(getApiErrorMessage(requestError, '任务创建失败，请稍后重试。'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">我的任务列表</h1>
          <p className="text-sm text-slate-600">先创建论文任务，再进入任务四阶段流程推进。</p>
        </div>
        <button
          type="button"
          onClick={() => void loadTasks()}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          disabled={loading}
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </header>

      <form onSubmit={handleCreateTask} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-medium">创建论文任务</h2>
        <label className="text-sm">任务标题（必填）
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：数字经济背景下中小企业融资问题研究" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting} maxLength={MAX_TITLE_LENGTH} />
        </label>
        <label className="text-sm">省份
          <select value={provinceId} onChange={(event) => setProvinceId(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting}>
            <option value="">请选择省份</option>{provinces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm">城市
          <select value={cityId} onChange={(event) => setCityId(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting || !provinceId}>
            <option value="">请选择城市</option>{cities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm">学校（必填）
          <select value={academicSchoolId} onChange={(event) => setAcademicSchoolId(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting}>
            <option value="">请选择学校</option>{schools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm">学院
          <select value={collegeId} onChange={(event) => setCollegeId(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting || !academicSchoolId}>
            <option value="">不指定学院</option>{colleges.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm">专业（必填）
          <select value={majorId} onChange={(event) => setMajorId(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting || !academicSchoolId}>
            <option value="">请选择专业</option>{majors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm">学历层次（必填）
          <select value={educationLevel} onChange={(event) => setEducationLevel(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting}>
            <option value="JUNIOR_COLLEGE">高职/专科</option><option value="UNDERGRADUATE">本科</option><option value="UPGRADE_UNDERGRADUATE">专升本</option><option value="MASTER">硕士</option><option value="COURSE_PAPER">课程论文</option>
          </select>
        </label>
        <label className="text-sm">论文类型
          <select value={thesisType} onChange={(event) => setThesisType(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting}>
            <option value="FULL_PAPER">毕业论文</option><option value="PROPOSAL">开题报告</option><option value="OUTLINE">论文大纲</option><option value="RESEARCH_REPORT">研究报告</option><option value="CASE_ANALYSIS">案例分析</option><option value="GRADUATION_DESIGN">毕业设计</option>
          </select>
        </label>
        <label className="text-sm">目标字数（必填）
          <input value={wordCountTarget} onChange={(event) => setWordCountTarget(event.target.value)} placeholder="例如：8000" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting} inputMode="numeric" />
        </label>
        <label className="text-sm md:col-span-2">研究方向 / 题目描述（必填）
          <textarea value={topic} onChange={(event) => setTopic(event.target.value)} rows={3} placeholder="例如：人工智能教育应用、工程造价全过程控制" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting} maxLength={MAX_TOPIC_LENGTH} />
        </label>
        <label className="text-sm md:col-span-2">导师要求（选填）
          <textarea value={advisorRequirement} onChange={(event) => setAdvisorRequirement(event.target.value)} rows={2} placeholder="例如：强调案例分析、结合某企业数据、一级标题按学校模板" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting} maxLength={1000} />
        </label>

        {submitError ? <p className="md:col-span-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p> : null}
        {submitSuccess ? <p className="md:col-span-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{submitSuccess}</p> : null}
        <div className="md:col-span-2">
          <button type="submit" disabled={submitting} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{submitting ? '提交中...' : '创建任务'}</button>
        </div>
      </form>

      {loading ? <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">加载中...</div> : null}
      {error ? <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div> : null}

      {!loading && !error && (data?.items?.length || 0) === 0 ? (
        <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">暂无任务，先创建任务后再进入论文任务。</div>
      ) : null}

      {!loading && !error && (data?.items?.length || 0) > 0 ? (
        <ul className="space-y-3">
          {data?.items.map((task) => (
            <li key={task.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{task.title || `任务 ${task.id.slice(0, 8)}`}</h2>
                  <p className="mt-1 text-xs text-slate-500">{task.schoolName || '未绑定学校'} / {task.majorName || task.major} / {task.educationLevel} / {task.thesisType || '未指定类型'}</p>
                  <p className="text-xs text-slate-500">状态：{task.status}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/student/tasks/${encodeURIComponent(task.id)}/workbench`} className="rounded bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800">
                    文档工作台
                  </Link>
                  <Link href={`/tasks?taskId=${encodeURIComponent(task.id)}`} className="rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                    阶段生成
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && !error && totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50">上一页</button>
          <span>第 {page} / {totalPages} 页</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50">下一页</button>
        </div>
      ) : null}
    </section>
  );
}
