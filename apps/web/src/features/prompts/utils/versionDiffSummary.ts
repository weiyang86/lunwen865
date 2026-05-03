import type { ModelConfig, PromptMetadata, PromptVariable } from '@/types/prompt';

export type VersionSnapshot = {
  content: string;
  variables: PromptVariable[];
  modelConfig: ModelConfig;
  metadata: PromptMetadata;
};

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function setDiff(a: string[], b: string[]) {
  const bSet = new Set(b);
  const aSet = new Set(a);
  return {
    added: a.filter((x) => !bSet.has(x)),
    removed: b.filter((x) => !aSet.has(x)),
  };
}

export function computeVersionDiffSummary(a: VersionSnapshot, b: VersionSnapshot): string[] {
  const lines: string[] = [];

  const lenDiff = a.content.length - b.content.length;
  if (lenDiff !== 0) lines.push(`内容长度 ${lenDiff > 0 ? '+' : ''}${lenDiff} 字`);

  const aNames = a.variables.map((v) => v.name);
  const bNames = b.variables.map((v) => v.name);
  const vDiff = setDiff(aNames, bNames);
  if (vDiff.added.length === 0 && vDiff.removed.length === 0) {
    if (!sameJson(a.variables, b.variables)) lines.push('变量元信息已修改');
  } else {
    const parts: string[] = [];
    for (const x of vDiff.added) parts.push(`+${x}`);
    for (const x of vDiff.removed) parts.push(`-${x}`);
    lines.push(`变量：${parts.join(' ')}`);
  }

  if (a.modelConfig.provider !== b.modelConfig.provider) {
    lines.push(`提供商：${b.modelConfig.provider} → ${a.modelConfig.provider}`);
  }
  if (a.modelConfig.model !== b.modelConfig.model) {
    lines.push(`模型：${b.modelConfig.model} → ${a.modelConfig.model}`);
  }

  if (a.modelConfig.temperature !== b.modelConfig.temperature) {
    lines.push(`Temperature：${b.modelConfig.temperature} → ${a.modelConfig.temperature}`);
  }
  if (a.modelConfig.maxTokens !== b.modelConfig.maxTokens) {
    lines.push(`Max Tokens：${b.modelConfig.maxTokens} → ${a.modelConfig.maxTokens}`);
  }

  const advKeys: Array<keyof ModelConfig> = ['topP', 'frequencyPenalty', 'presencePenalty'];
  const advChanged = advKeys.some((k) => (a.modelConfig as any)[k] !== (b.modelConfig as any)[k]);
  if (advChanged) lines.push('高级参数已修改');

  if (a.metadata.title !== b.metadata.title) lines.push('标题已修改');
  if (a.metadata.description !== b.metadata.description) lines.push('描述已修改');
  const tagDiff = setDiff(a.metadata.tags, b.metadata.tags);
  if (tagDiff.added.length || tagDiff.removed.length) {
    const parts: string[] = [];
    for (const x of tagDiff.added) parts.push(`+${x}`);
    for (const x of tagDiff.removed) parts.push(`-${x}`);
    lines.push(`标签：${parts.join(' ')}`);
  }

  return lines;
}

