import { AgencyTaskTimelinePanel } from '@/components/agency/agency-task-timeline-panel';

export default async function AgencyProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string }>;
}) {
  const params = await searchParams;

  return <AgencyTaskTimelinePanel taskId={params.taskId} />;
}
