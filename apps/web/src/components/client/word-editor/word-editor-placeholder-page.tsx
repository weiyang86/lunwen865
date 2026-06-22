'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TaskStageNav } from '@/components/client/task-flow/task-stage-nav';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';

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
  document: { id: string; currentVersion: number } | null;
};

type EditorConfigResp = {
  enabled?: boolean;
  documentServerUrl: string;
  editorConfig: Record<string, unknown> | null;
  missingConfig?: string[];
  warnings?: string[];
};

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (containerId: string, config: Record<string, unknown>) => {
        destroyEditor?: () => void;
      };
    };
  }
}

function sourceLabel(source?: string) {
  if (source === 'ONLYOFFICE_EDITED') return '在线编辑';
  if (source === 'MANUAL_UPLOAD') return '手动上传';
  return '生成初稿';
}

function fileSizeText(size?: number | null) {
  if (!size) return '未知大小';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function WordEditorPlaceholderPage({ taskId }: { taskId: string }) {
  const [data, setData] = useState<WordFilesResp | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editorLoaded, setEditorLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<{ destroyEditor?: () => void } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [next, workbench] = await Promise.all([
        clientHttp.get<WordFilesResp>(`/thesis-tasks/${taskId}/word-files`),
        clientHttp.get<WorkbenchDocumentResp>(`/thesis-tasks/${taskId}/document`),
      ]);
      setData(next);
      setDocumentId(workbench.document?.id ?? null);
    } catch (e) {
      setError(getApiErrorMessage(e, '加载在线 Word 精修数据失败'));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
    return () => editorRef.current?.destroyEditor?.();
  }, [load]);

  async function loadOnlyOfficeScript(documentServerUrl: string) {
    if (window.DocsAPI) return;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${documentServerUrl.replace(/\/+$/, '')}/web-apps/apps/api/documents/api.js`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('在线 Word 编辑服务暂不可用。'));
      document.body.appendChild(script);
    });
  }

  async function openEditor() {
    if (!data?.current) {
      setError('请先生成 Word 初稿。');
      return;
    }
    setOpening(true);
    setError(null);
    setMessage(null);
    try {
      const config = await clientHttp.get<EditorConfigResp>(
        `/thesis-word-files/${data.current.id}/editor-config`,
      );
      if (config.enabled === false) {
        throw new Error('在线 Word 编辑未启用');
      }
      if (config.missingConfig?.length) {
        throw new Error(`ONLYOFFICE 配置缺失：${config.missingConfig.join('、')}`);
      }
      if (!config.documentServerUrl || !config.editorConfig) {
        throw new Error('在线 Word 编辑服务未配置，请联系管理员。');
      }
      await loadOnlyOfficeScript(config.documentServerUrl);
      if (!window.DocsAPI) throw new Error('在线 Word 编辑服务暂不可用。');
      editorRef.current?.destroyEditor?.();
      editorRef.current = new window.DocsAPI.DocEditor(
        'onlyoffice-editor-container',
        config.editorConfig,
      );
      setEditorLoaded(true);
      setMessage(
        config.warnings?.length
          ? config.warnings.join('；')
          : 'ONLYOFFICE 编辑器已打开。保存通常通过文档关闭或保存回调完成，版本记录以回调结果为准。',
      );
    } catch (e) {
      setError(getApiErrorMessage(e, '在线 Word 编辑服务暂不可用'));
    } finally {
      setOpening(false);
    }
  }

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
      setMessage('已根据当前合稿与格式重新生成最新 Word，可继续在线精修或直接进入最终交付。');
    } catch (e) {
      setError(getApiErrorMessage(e, '生成最新格式版失败'));
    } finally {
      setGenerating(false);
    }
  }

  const current = data?.current;

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 lg:p-6">
      <section className="mx-auto max-w-7xl space-y-4">
        <TaskStageNav taskId={taskId} activeStage="word-editor" />

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">在线 Word 精修</h1>
              <p className="mt-2 text-sm text-slate-600">
                在线 Word 精修适用于最终排版、复杂表格、图片、页眉页脚和版式检查。保存后的 Word 文件将作为后续最终交付版本。
              </p>
              <p className="mt-2 text-xs text-slate-500">
                ONLYOFFICE 的保存通常通过文档关闭或保存回调完成。保存完成后，系统会生成新的 Word 文件版本；本页不会假装立即保存成功。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {current ? <a className="rounded border border-slate-300 px-3 py-2 text-sm" href={`/api/thesis-word-files/${current.id}/download`}>下载当前 Word</a> : null}
              <button
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                disabled={!documentId || generating}
                onClick={() => void generateLatestWord()}
              >
                {generating ? '生成中...' : '生成最新格式版'}
              </button>
              <button className="rounded bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-60" disabled={!current || opening} onClick={() => void openEditor()}>{opening ? '打开中...' : '打开在线 Word 编辑'}</button>
              <Link
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                href={`/student/tasks/${encodeURIComponent(taskId)}/delivery`}
              >
                前往最终交付
              </Link>
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => void load()}>刷新版本记录</button>
            </div>
          </div>
          {loading ? <div className="mt-4 rounded border border-slate-200 p-3 text-sm text-slate-500">加载 Word 文件状态中...</div> : null}
          {message ? <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
          {error ? <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}
          {!loading && !current ? <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><div className="font-medium">当前任务尚未生成 Word 初稿</div><p className="mt-1">请先进入合稿与格式生成 Word 初稿，再返回本页进行在线精修。</p><Link className="mt-3 inline-block rounded bg-slate-900 px-4 py-2 text-white" href={`/student/tasks/${encodeURIComponent(taskId)}/compose-format`}>去合稿与格式</Link></div> : null}
        </div>

        {current ? <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <div id="onlyoffice-editor-container" className="min-h-[72vh] rounded-lg border border-slate-200 bg-slate-50">
              {!editorLoaded ? <div className="flex min-h-[72vh] items-center justify-center p-6 text-center text-sm text-slate-500">点击“打开在线 Word 编辑”后将在此加载 ONLYOFFICE 编辑器。若提示配置缺失，请检查 ONLYOFFICE_DOCUMENT_SERVER_PUBLIC_URL、ONLYOFFICE_CALLBACK_BASE_URL 与 ONLYOFFICE_FILE_BASE_URL。</div> : null}
            </div>
          </section>
          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <h2 className="font-medium">当前 Word 文件</h2>
              <div className="mt-3 space-y-1 text-slate-600">
                <div>文件名：{current.fileName}</div>
                <div>当前版本：v{current.currentVersion}</div>
                <div>状态：{current.status}</div>
                <div>最近更新：{new Date(current.updatedAt).toLocaleString()}</div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <h2 className="font-medium">版本记录</h2>
              <div className="mt-3 space-y-2">
                {current.versions?.length ? current.versions.map((v) => <div key={v.id} className="rounded border border-slate-200 p-3"><div className="font-medium">v{v.version} · {sourceLabel(v.sourceType)}</div><div className="mt-1 text-xs text-slate-500">{new Date(v.createdAt).toLocaleString()} · {fileSizeText(v.fileSize)}</div><a className="mt-2 inline-block text-indigo-600 hover:underline" href={`/api/thesis-word-file-versions/${v.id}/download`}>下载该版本</a></div>) : <div className="text-slate-500">暂无版本记录</div>}
              </div>
            </div>
          </aside>
        </div> : null}
      </section>
    </main>
  );
}
