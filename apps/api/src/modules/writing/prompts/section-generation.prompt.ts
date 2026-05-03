import type { SectionContext } from '../interfaces/writing-context.interface';

function getEducationLabel(level: string): string {
  if (level.includes('博士')) return '博士学位论文';
  if (level.includes('硕士') || level.includes('研究生')) return '硕士学位论文';
  return '本科毕业论文';
}

export function buildSectionVars(ctx: SectionContext): {
  educationLabel: string;
  title: string;
  topic: string;
  keywordsText: string;
  totalWordCount: number;
  allChapterTitlesText: string;
  chapterTitle: string;
  sectionTitle: string;
  sectionSummary: string;
  expectedWords: number;
  previousSummaryBlock: string;
} {
  const { task, currentNode, previousSummary, position, allChapterTitles } =
    ctx;
  const allChapterTitlesText = allChapterTitles
    .map((t, i) => `${i + 1}. ${t}`)
    .join('\n');

  const previousSummaryBlock = previousSummary
    ? `### 上一节末尾（保证连贯，仅参考，勿复述）\n"${previousSummary}"\n\n请确保本节开头自然衔接。\n\n`
    : '';

  return {
    educationLabel: getEducationLabel(task.educationLevel),
    title: task.title,
    topic: task.topic,
    keywordsText: task.keywords.join('、'),
    totalWordCount: task.totalWordCount,
    allChapterTitlesText,
    chapterTitle: position.chapter,
    sectionTitle: currentNode.title,
    sectionSummary: currentNode.summary ?? '',
    expectedWords: currentNode.expectedWords,
    previousSummaryBlock,
  };
}
