import { FinalDeliveryPage } from '@/components/client/task-flow/final-delivery-page';

export default async function Page({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <FinalDeliveryPage taskId={taskId} />;
}
