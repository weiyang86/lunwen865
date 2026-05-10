import { AgencyTaskTimelinePanel } from '@/components/agency/agency-task-timeline-panel';

export default async function AgencyProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string }>;
}) {
  const params = await searchParams;

  return <AgencyTaskTimelinePanel taskId={params.taskId} />;
import { AgencyPageState, resolveAgencyPageState } from '@/components/agency/agency-page-state';

export default function AgencyProgressPage({
  searchParams,
}: {
  searchParams?: { state?: string | string[] };
}) {
  const state = resolveAgencyPageState(searchParams?.state);

  return (
    <AgencyPageState
      title="进度追踪"
      state={state}
      emptyMessage="当前暂无进行中的任务进度。"
      errorMessage="任务进度加载失败。"
    >
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">进度追踪（骨架）</h1>
        <p className="text-sm text-slate-600">用于后续接入题目、开题、正文、改稿等阶段的协同进度查看。</p>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-slate-700">阶段时间线（占位）</p>
          <p className="text-xs text-slate-500">计划展示阶段节点、状态、更新时间与交付附件。</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-slate-700">协同记录（占位）</p>
          <p className="text-xs text-slate-500">计划展示机构留言、导师反馈、补充材料与驳回原因。</p>
        </div>
      </section>
    </AgencyPageState>
  );
}
