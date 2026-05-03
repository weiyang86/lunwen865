'use client';

import { PromptEditPage as PromptEditPageView } from '@/features/prompts/PromptEditPage';

export default function PromptEditPage({ params }: { params: { id: string } }) {
  return <PromptEditPageView id={params.id} />;
}
