export type EstimatedDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface LlmTopicOutput {
  candidates: Array<{
    title: string;
    rationale: string;
    keywords: string[];
    estimatedDifficulty: EstimatedDifficulty;
  }>;
}
