import { TaskTimelinePanel } from '@/components/client/task-timeline-panel';
import { ClientPageState, resolveClientPageState } from '@/components/client/client-page-state';

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string }>;
}) {
  const params = await searchParams;

  return <TaskTimelinePanel taskId={params.taskId} />;
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const params = await searchParams;
  const state = resolveClientPageState(params.state);

  return (
    <ClientPageState
      title="任务工作台（骨架）"
      state={state}
      emptyMessage="暂无任务数据"
      errorMessage="任务页加载失败"
    >
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">任务工作台（骨架）</h1>
        <p className="text-sm text-slate-600">用于后续接入任务阶段时间线与交付内容查看。</p>
      </section>
    </ClientPageState>
  );
}
