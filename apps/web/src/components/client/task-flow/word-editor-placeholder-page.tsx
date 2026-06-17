import Link from 'next/link';
import { TaskStageNav } from '@/components/client/task-flow/task-stage-nav';

type WordEditorPlaceholderPageProps = {
  taskId: string;
};

export function WordEditorPlaceholderPage({ taskId }: WordEditorPlaceholderPageProps) {
  return (
    <div className="space-y-6 pb-12">
      <TaskStageNav taskId={taskId} activeStage="word-editor" />
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">在线 Word 精修</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">在线 Word 精修</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            在线 Word 精修将在生成 DOCX 后开放，用于进行最终人工排版、复杂表格、图片、页眉页脚和版式检查。精修后的 Word 文件将作为最终交付版本。
          </p>
          <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            当前 Issue 仅开放任务内入口和占位说明；ONLYOFFICE 在线编辑、保存回调与版本记录将在后续 Issue 接入。
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={`/student/tasks/${encodeURIComponent(taskId)}/compose-format`} className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
              前往合稿与格式
            </Link>
            <Link href="/downloads" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              查看下载中心
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
