import { ClientTaskTopicWorkspacePage } from '@/components/client/client-task-topic-workspace-page';

export default async function Page({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <ClientTaskTopicWorkspacePage initialTaskId={taskId} routeMode="path" />;
}
