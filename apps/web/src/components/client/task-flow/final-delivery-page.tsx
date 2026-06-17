import Link from 'next/link';
import { TaskStageNav } from '@/components/client/task-flow/task-stage-nav';

type FinalDeliveryPageProps = {
  taskId: string;
};

export function FinalDeliveryPage({ taskId }: FinalDeliveryPageProps) {
  return (
    <div className="space-y-6 pb-12">
      <TaskStageNav taskId={taskId} activeStage="delivery" />
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">最终交付</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">最终交付</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            最终交付用于下载论文最终版本。若已完成在线 Word 精修，则以最新 Word 文件版本为准；否则以合稿与格式生成的 DOCX 为准。
          </p>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            首期最终交付入口复用现有下载中心与导出记录。最终稿确认、版本优先级和交付记录将在后续 Final-Delivery Issue 完整建设。
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/downloads" className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
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
