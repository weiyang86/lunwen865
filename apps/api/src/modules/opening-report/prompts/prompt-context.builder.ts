import type {
  GenerationContext,
  PreviousSection,
} from '../interfaces/generation-context.interface';

export function buildPreviousSectionsContext(
  sections: PreviousSection[],
): string {
  if (sections.length === 0) return '';

  const lines = sections.map((s, i) => {
    return `${i + 1}. **${s.title}**：${s.summary}`;
  });

  return [
    '',
    '## 前文已写章节摘要',
    lines.join('\n'),
    '',
    '请确保本章节内容与前文逻辑连贯，避免重复表述。',
    '',
  ].join('\n');
}

export function buildCommonPaperInfo(ctx: GenerationContext): string {
  return [
    '## 论文信息',
    `- 题目：${ctx.title}`,
    `- 主题领域：${ctx.topic}`,
    `- 关键词：${ctx.keywords.join('、')}`,
    '',
  ].join('\n');
}

export function buildAcademicLevelText(ctx: GenerationContext): string {
  const levelMap: Record<GenerationContext['academicLevel'], string> = {
    UNDERGRADUATE: '本科毕业论文',
    MASTER: '硕士学位论文',
    DOCTOR: '博士学位论文',
  };
  return levelMap[ctx.academicLevel];
}

export function buildAdditionalRequirements(ctx: GenerationContext): string {
  const req = ctx.additionalRequirements?.trim();
  if (!req) return '';
  return ['## 额外要求', req, ''].join('\n');
}
