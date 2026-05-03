import type { SectionConfig } from '../interfaces/section-config.interface';
import type { GenerationContext } from '../interfaces/generation-context.interface';
import {
  buildBackgroundPrompt,
  buildLiteratureReviewPrompt,
  buildMethodologyPrompt,
  buildResearchContentPrompt,
  buildSchedulePrompt,
  buildSignificancePrompt,
} from '../prompts';

export const OPENING_REPORT_SECTIONS: readonly SectionConfig[] = [
  {
    key: 'background',
    title: '研究背景',
    index: 0,
    expectedWordCount: { min: 600, max: 1000 },
    promptBuilder: (ctx: GenerationContext) => buildBackgroundPrompt(ctx),
  },
  {
    key: 'significance',
    title: '研究意义',
    index: 1,
    expectedWordCount: { min: 500, max: 800 },
    promptBuilder: (ctx: GenerationContext) => buildSignificancePrompt(ctx),
  },
  {
    key: 'literatureReview',
    title: '文献综述',
    index: 2,
    expectedWordCount: { min: 1000, max: 1500 },
    promptBuilder: (ctx: GenerationContext) => buildLiteratureReviewPrompt(ctx),
  },
  {
    key: 'researchContent',
    title: '研究内容',
    index: 3,
    expectedWordCount: { min: 800, max: 1200 },
    promptBuilder: (ctx: GenerationContext) => buildResearchContentPrompt(ctx),
  },
  {
    key: 'methodology',
    title: '研究方法',
    index: 4,
    expectedWordCount: { min: 600, max: 1000 },
    promptBuilder: (ctx: GenerationContext) => buildMethodologyPrompt(ctx),
  },
  {
    key: 'schedule',
    title: '研究进度安排',
    index: 5,
    expectedWordCount: { min: 400, max: 600 },
    promptBuilder: (ctx: GenerationContext) => buildSchedulePrompt(ctx),
  },
] as const;
