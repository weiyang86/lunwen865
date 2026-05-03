export type AcademicLevel = 'UNDERGRADUATE' | 'MASTER' | 'DOCTOR';

export interface OutlineGenerationContext {
  taskId: string;
  title: string;
  topic: string;
  keywords: string[];
  academicLevel: AcademicLevel;
  targetWordCount: number;
  openingReportContent: string;
  additionalRequirements?: string;
  maxDepth: number;
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

export function buildOutlineGenerationVars(ctx: OutlineGenerationContext): {
  academicLevelText: string;
  title: string;
  topic: string;
  keywordsText: string;
  targetWordCount: number;
  openingReportTruncated: string;
  additionalRequirementsBlock: string;
  chapterCountRange: string;
  maxDepth: number;
  sectionMinWords: number;
  sectionMaxWords: number;
} {
  const keywordsText =
    Array.isArray(ctx.keywords) && ctx.keywords.length > 0
      ? ctx.keywords.join('、')
      : '（无）';

  const sectionMinWords = Math.max(200, Math.round(ctx.targetWordCount * 0.05));
  const sectionMaxWords = Math.min(
    3000,
    Math.round(ctx.targetWordCount * 0.15),
  );

  return {
    academicLevelText: academicLevelText(ctx.academicLevel),
    title: ctx.title,
    topic: ctx.topic,
    keywordsText,
    targetWordCount: ctx.targetWordCount,
    openingReportTruncated: truncate(ctx.openingReportContent ?? '', 3000),
    additionalRequirementsBlock: ctx.additionalRequirements
      ? `## 用户额外要求\n${ctx.additionalRequirements}\n\n`
      : '',
    chapterCountRange: ctx.academicLevel === 'UNDERGRADUATE' ? '5-7' : '6-8',
    maxDepth: ctx.maxDepth,
    sectionMinWords,
    sectionMaxWords,
  };
}
