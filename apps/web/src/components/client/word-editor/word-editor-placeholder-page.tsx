'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';

type WordFile = {
  id: string;
  fileName: string;
  fileUrl: string;
  currentVersion: number;
  status: string;
  updatedAt: string;
  versions?: Array<{ id: string; version: number; fileName: string; createdAt: string }>;
};

type WordFilesResp = { current: WordFile | null; items: WordFile[] };

export function WordEditorPlaceholderPage({ taskId }: { taskId: string }) {
  const [data, setData] = useState<WordFilesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await clientHttp.get<WordFilesResp>(`/thesis-tasks/${taskId}/word-files`);
      setData(next);
    } catch (e) {
      setError(getApiErrorMessage(e, '加载 Word 初稿失败'));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { void load(); }, [load]);

  return <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
    <section className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="text-2xl font-semibold">在线 Word 精修</h1>
      <p className="mt-2 text-sm text-slate-600">OnlyOffice 在线编辑将在 OnlyOffice-01 中开放。本页当前用于识别并下载已生成的 Word 初稿。</p>
      {loading ? <div className="mt-6 rounded border border-slate-200 p-4 text-sm text-slate-500">加载 Word 文件状态中...</div> : null}
      {error ? <div className="mt-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div> : null}
      {!loading && !data?.current ? <div className="mt-6 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><div className="font-medium">尚未生成 Word 初稿</div><p className="mt-1">请返回合稿与格式页面，先点击“生成 Word 初稿”。</p><Link className="mt-3 inline-block rounded bg-slate-900 px-4 py-2 text-white" href={`/student/tasks/${encodeURIComponent(taskId)}/workbench`}>返回合稿与格式</Link></div> : null}
      {data?.current ? <div className="mt-6 space-y-4 rounded border border-slate-200 p-4"><div><div className="text-sm text-slate-500">当前 Word 初稿</div><div className="mt-1 font-medium">{data.current.fileName}</div><div className="mt-1 text-sm text-slate-500">状态：{data.current.status} · 当前版本：v{data.current.currentVersion} · {new Date(data.current.updatedAt).toLocaleString()}</div></div><div className="flex flex-wrap gap-2"><a href={`/api/thesis-word-files/${data.current.id}/download`} className="rounded bg-slate-900 px-4 py-2 text-sm text-white">下载当前 Word</a><button disabled className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-400">在线编辑将在 OnlyOffice-01 开放</button><Link href={`/student/tasks/${encodeURIComponent(taskId)}/workbench`} className="rounded border border-slate-300 px-4 py-2 text-sm">返回合稿与格式</Link></div><div><h2 className="font-medium">最近版本</h2><div className="mt-2 space-y-2">{data.current.versions?.map((v) => <div key={v.id} className="flex items-center justify-between rounded bg-slate-50 p-2 text-sm"><span>v{v.version} · {new Date(v.createdAt).toLocaleString()}</span><a className="text-indigo-600 hover:underline" href={`/api/thesis-word-file-versions/${v.id}/download`}>下载</a></div>)}</div></div></div> : null}
    </section>
  </main>;
}
