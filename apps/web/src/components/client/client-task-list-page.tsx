'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';

type TaskItem = {
  id: string;
  title: string | null;
  major: string;
  educationLevel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

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
};

const MAX_TITLE_LENGTH = 200;
const MAX_SCHOOL_LENGTH = 100;
const MAX_MAJOR_LENGTH = 200;
const MAX_EDUCATION_LEVEL_LENGTH = 200;
const MAX_TOPIC_LENGTH = 500;

export function ClientTaskListPage() {
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TaskListResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [major, setMajor] = useState('');
  const [educationLevel, setEducationLevel] = useState('');
  const [topic, setTopic] = useState('');

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await clientHttp.get<TaskListResponse>('/tasks/me', {
        page,
        pageSize: 10,
      });
      setData(result);
    } catch {
      setError('加载任务列表失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const totalPages = data?.totalPages ?? Math.max(1, Math.ceil((data?.total || 0) / (data?.pageSize || 10)));

  const formError = useMemo(() => {
    if (!title.trim()) return '请填写论文任务标题。';
    if (title.trim().length > MAX_TITLE_LENGTH) return `任务标题不能超过 ${MAX_TITLE_LENGTH} 个字符。`;
    if (schoolId.trim().length > MAX_SCHOOL_LENGTH) return `学校信息不能超过 ${MAX_SCHOOL_LENGTH} 个字符。`;
    if (!major.trim()) return '请填写专业信息。';
    if (major.trim().length > MAX_MAJOR_LENGTH) return `专业信息不能超过 ${MAX_MAJOR_LENGTH} 个字符。`;
    if (!educationLevel.trim()) return '请填写学历层次。';
    if (educationLevel.trim().length > MAX_EDUCATION_LEVEL_LENGTH) return `学历层次不能超过 ${MAX_EDUCATION_LEVEL_LENGTH} 个字符。`;
    if (!topic.trim()) return '请填写论文方向或题目描述。';
    if (topic.trim().length > MAX_TOPIC_LENGTH) return `论文方向描述不能超过 ${MAX_TOPIC_LENGTH} 个字符。`;
    return null;
  }, [title, schoolId, major, educationLevel, topic]);

  const resetForm = () => {
    setTitle('');
    setSchoolId('');
    setMajor('');
    setEducationLevel('');
    setTopic('');
  };

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (formError) {
      setSubmitError(formError);
      return;
    }

    const payload: CreateTaskPayload = {
      title: title.trim(),
      major: major.trim(),
      educationLevel: educationLevel.trim(),
      topic: topic.trim(),
    };

    if (schoolId.trim()) {
      payload.schoolId = schoolId.trim();
    }

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
          <p className="text-sm text-slate-600">先创建论文任务，再进入题目生成流程。</p>
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
        <label className="text-sm">学校（选填）
          <input value={schoolId} onChange={(event) => setSchoolId(event.target.value)} placeholder="例如：某某大学" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting} maxLength={MAX_SCHOOL_LENGTH} />
        </label>
        <label className="text-sm">专业（必填）
          <input value={major} onChange={(event) => setMajor(event.target.value)} placeholder="例如：工商管理" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting} maxLength={MAX_MAJOR_LENGTH} />
        </label>
        <label className="text-sm">学历层次（必填）
          <input value={educationLevel} onChange={(event) => setEducationLevel(event.target.value)} placeholder="例如：本科" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting} maxLength={MAX_EDUCATION_LEVEL_LENGTH} />
        </label>
        <label className="text-sm md:col-span-2">论文方向描述（必填）
          <textarea value={topic} onChange={(event) => setTopic(event.target.value)} rows={3} placeholder="例如：聚焦供应链金融场景，关注 2022-2025 年的政策与案例" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" disabled={submitting} maxLength={MAX_TOPIC_LENGTH} />
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
        <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">暂无任务，先创建任务后再进入题目生成。</div>
      ) : null}

      {!loading && !error && (data?.items?.length || 0) > 0 ? (
        <ul className="space-y-3">
          {data?.items.map((task) => (
            <li key={task.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{task.title || `任务 ${task.id.slice(0, 8)}`}</h2>
                  <p className="mt-1 text-xs text-slate-500">{task.major} / {task.educationLevel}</p>
                  <p className="text-xs text-slate-500">状态：{task.status}</p>
                </div>
                <Link href={`/tasks?taskId=${encodeURIComponent(task.id)}`} className="rounded bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800">
                  进入题目生成
                </Link>
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
