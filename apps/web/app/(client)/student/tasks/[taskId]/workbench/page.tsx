import { ThesisDocumentWorkbenchPage } from '@/components/client/thesis-workbench/thesis-document-workbench-page';

export default async function Page({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <ThesisDocumentWorkbenchPage taskId={taskId} />;
}
