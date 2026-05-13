import { ClientTopicWorkbench } from '@/components/client/client-topic-workbench';

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string }>;
}) {
  const params = await searchParams;

  return <ClientTopicWorkbench taskId={params.taskId} />;
}
