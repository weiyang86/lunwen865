import { ClientTaskListPage } from '@/components/client/client-task-list-page';
import { TaskTimelinePanel } from '@/components/client/task-timeline-panel';

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string }>;
}) {
  const params = await searchParams;
  if (params.taskId) {
    return <TaskTimelinePanel taskId={params.taskId} />;
  }
  return <ClientTaskListPage />;
}
