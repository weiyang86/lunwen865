import type { SectionContext } from '../interfaces/writing-context.interface';
import { buildSectionVars } from './section-generation.prompt';

export function buildSectionRetryVars(
  ctx: SectionContext,
  feedback: string,
): {
  feedback: string;
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
  const safe = feedback.replace(/[\r\n]+/g, ' ').slice(0, 500);
  return { feedback: safe, ...buildSectionVars(ctx) };
}
