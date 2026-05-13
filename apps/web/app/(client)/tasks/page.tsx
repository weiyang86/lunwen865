import { TaskTimelinePanel } from '@/components/client/task-timeline-panel';

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string }>;
}) {
  const params = await searchParams;

  return <TaskTimelinePanel taskId={params.taskId} />;
}
