import type { AcademicLevel } from './outline-generation.prompt';

export interface SiblingOutlineHint {
  title: string;
  summary: string;
}

export interface SectionRegenerationContext {
  taskId: string;
  paperTitle: string;
  topic: string;
  keywords: string[];
  academicLevel: AcademicLevel;
  targetWordCount: number;
  outlineMaxDepth: number;

  currentNodeTitle: string;
  currentNodeSummary?: string;
  currentNodeDepth: number;

  siblings: SiblingOutlineHint[];
  outlineSkeleton: string;

  feedback?: string;
  additionalRequirements?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  timeout?: number;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '\n…（内容过长已截断）';
}

function academicLevelText(level: AcademicLevel): string {
  if (level === 'MASTER') return '硕士学位论文';
  if (level === 'DOCTOR') return '博士学位论文';
  return '本科毕业论文';
}

export function buildSectionRegenerationVars(ctx: SectionRegenerationContext): {
  academicLevelText: string;
  paperTitle: string;
  topic: string;
  keywordsText: string;
  targetWordCount: number;
  outlineMaxDepth: number;
  currentNodeTitle: string;
  currentNodeDepth: number;
  currentNodeSummaryText: string;
  siblingsText: string;
  outlineSkeletonTruncated: string;
  feedbackBlock: string;
  additionalRequirementsBlock: string;
} {
  const keywordsText =
    Array.isArray(ctx.keywords) && ctx.keywords.length > 0
      ? ctx.keywords.join('、')
      : '（无）';

  const siblingsText =
    ctx.siblings.length > 0
      ? ctx.siblings
          .slice(0, 10)
          .map((s, i) => `- ${i + 1}. ${s.title}：${truncate(s.summary, 120)}`)
          .join('\n')
      : '- （无）';

  return {
    academicLevelText: academicLevelText(ctx.academicLevel),
    paperTitle: ctx.paperTitle,
    topic: ctx.topic,
    keywordsText,
    targetWordCount: ctx.targetWordCount,
    outlineMaxDepth: ctx.outlineMaxDepth,
    currentNodeTitle: ctx.currentNodeTitle,
    currentNodeDepth: ctx.currentNodeDepth,
    currentNodeSummaryText: ctx.currentNodeSummary
      ? truncate(ctx.currentNodeSummary, 200)
      : '（无）',
    siblingsText,
    outlineSkeletonTruncated: truncate(ctx.outlineSkeleton, 2500),
    feedbackBlock: ctx.feedback ? `## 用户反馈\n${ctx.feedback}\n\n` : '',
    additionalRequirementsBlock: ctx.additionalRequirements
      ? `## 额外要求\n${ctx.additionalRequirements}\n\n`
      : '',
  };
}
