import type { GenerationContext } from './generation-context.interface';

export interface SectionConfig {
  key: string;
  title: string;
  index: number;
  expectedWordCount: { min: number; max: number };
  promptBuilder: (ctx: GenerationContext) => string;
}
