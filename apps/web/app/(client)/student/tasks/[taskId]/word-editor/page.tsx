import { WordEditorPlaceholderPage } from '@/components/client/task-flow/word-editor-placeholder-page';

export default async function Page({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <WordEditorPlaceholderPage taskId={taskId} />;
}
