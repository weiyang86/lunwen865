import { PromptEditPage as PromptEditPageView } from '@/features/prompts/PromptEditPage';

export default async function PromptEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PromptEditPageView id={id} />;
}
