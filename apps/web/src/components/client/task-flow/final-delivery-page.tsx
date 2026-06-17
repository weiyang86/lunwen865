'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TaskStageNav } from '@/components/client/task-flow/task-stage-nav';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';

type FinalDeliveryPageProps = {
  taskId: string;
};

type WordFileVersion = {
  id: string;
  version: number;
  fileName: string;
  fileSize?: number | null;
  sourceType?: string;
  createdAt: string;
};

type WordFile = {
  id: string;
  fileName: string;
  fileUrl: string;
  currentVersion: number;
  status: string;
  updatedAt: string;
  versions?: WordFileVersion[];
};

type WordFilesResp = { current: WordFile | null; items: WordFile[] };

type WorkbenchDocumentResp = {
  document: { id: string; currentVersion: number; updatedAt: string } | null;
};

function sourceLabel(source?: string) {
  if (source === 'ONLYOFFICE_EDITED') return '在线精修版本';
  if (source === 'MANUAL_UPLOAD') return '手动上传版本';
  return '合稿生成版本';
}

function fileSizeText(size?: number | null) {
  if (!size) return '未知大小';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function FinalDeliveryPage({ taskId }: FinalDeliveryPageProps) {
  const [wordInfo, setWordInfo] = useState<WordFilesResp | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentVersion, setDocumentVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [files, workbench] = await Promise.all([
        clientHttp.get<WordFilesResp>(`/thesis-tasks/${taskId}/word-files`),
        clientHttp.get<WorkbenchDocumentResp>(`/thesis-tasks/${taskId}/document`),
      ]);
      setWordInfo(files);
      setDocumentId(workbench.document?.id ?? null);
      setDocumentVersion(workbench.document?.currentVersion ?? null);
    } catch (e) {
      setError(getApiErrorMessage(e, '加载最终交付信息失败'));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = wordInfo?.current ?? null;
  const latestVersion = useMemo(() => current?.versions?.[0] ?? null, [current]);

  async function generateLatestWord() {
    if (!documentId) {
      setError('请先在“合稿与格式”中初始化论文文档并保存章节内容。');
      return;
    }
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      await clientHttp.post(`/thesis-documents/${documentId}/generate-docx`, {});
      await load();
      setMessage('已根据当前合稿与格式重新生成最新 Word，当前交付版本已更新。');
    } catch (e) {
      setError(getApiErrorMessage(e, '生成最新格式版失败'));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <TaskStageNav taskId={taskId} activeStage="delivery" />
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">最终交付</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">最终交付</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            最终交付用于下载论文最终版本。若已完成在线 Word 精修，则以最新 Word 文件版本为准；否则以合稿与格式生成的 DOCX 为准。
          </p>

          {message ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            推荐交付顺序：先在“合稿与格式”保存结构化内容，再生成 Word；如需排版优化，在“在线 Word 精修”完成保存并刷新版本；最终在本页下载当前交付版。
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-900">当前交付版本</h2>
              {loading ? (
                <div className="mt-3 text-sm text-slate-500">加载交付版本中...</div>
              ) : current ? (
                <div className="mt-3 space-y-3 text-sm text-slate-600">
                  <div>文件名：{current.fileName}</div>
                  <div>当前版本：v{current.currentVersion}</div>
                  <div>状态：{current.status}</div>
                  <div>文档主版本：{documentVersion ? `v${documentVersion}` : '未初始化'}</div>
                  <div>最近更新：{new Date(current.updatedAt).toLocaleString()}</div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                    当前交付优先级：在线 Word 精修最新版本 {'>'} 合稿与格式最近一次生成版本。
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/api/thesis-word-files/${current.id}/download`}
                      className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                    >
                      下载当前交付版
                    </a>
                    <button
                      type="button"
                      className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-60 hover:bg-slate-50"
                      disabled={!documentId || generating}
                      onClick={() => void generateLatestWord()}
                    >
                      {generating ? '生成中...' : '生成最新格式版'}
                    </button>
                    <Link
                      href={`/student/tasks/${encodeURIComponent(taskId)}/word-editor`}
                      className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      前往在线 Word 精修
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3 text-sm text-slate-600">
                  <div>当前还没有可交付的 Word 版本。</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
                      disabled={!documentId || generating}
                      onClick={() => void generateLatestWord()}
                    >
                      {generating ? '生成中...' : '先生成首个格式版'}
                    </button>
                    <Link
                      href={`/student/tasks/${encodeURIComponent(taskId)}/compose-format`}
                      className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      返回合稿与格式
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-slate-900">版本记录</h2>
              <div className="mt-3 space-y-2">
                {latestVersion ? (
                  current?.versions?.map((version) => (
                    <div key={version.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                      <div className="font-medium text-slate-900">
                        v{version.version} · {sourceLabel(version.sourceType)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {new Date(version.createdAt).toLocaleString()} · {fileSizeText(version.fileSize)}
                      </div>
                      <a
                        href={`/api/thesis-word-file-versions/${version.id}/download`}
                        className="mt-2 inline-block text-sm text-indigo-600 hover:underline"
                      >
                        下载该版本
                      </a>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">
                    暂无 Word 版本记录。请先在“合稿与格式”或本页生成最新格式版。
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/downloads" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              打开下载中心
            </Link>
            <Link href={`/student/tasks/${encodeURIComponent(taskId)}/compose-format`} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              返回合稿与格式
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
