import type { ModelConfig, PromptMetadata, PromptVariable, PromptVersion } from '@/types/prompt';

interface EditorSnapshot {
  content: string;
  variables: PromptVariable[];
  modelConfig: ModelConfig;
  metadata: PromptMetadata;
}

export function isDraftDirty(snap: EditorSnapshot, base: PromptVersion | null): boolean {
  if (!base) return snap.content !== '' || snap.variables.length > 0;
  if (snap.content !== base.content) return true;
  if (JSON.stringify(snap.variables) !== JSON.stringify(base.variables)) return true;
  if (JSON.stringify(snap.modelConfig) !== JSON.stringify(base.modelConfig)) return true;
  if (JSON.stringify(snap.metadata) !== JSON.stringify(base.metadata)) return true;
  return false;
}
