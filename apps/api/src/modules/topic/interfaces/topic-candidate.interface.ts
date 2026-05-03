import type { EstimatedDifficulty } from './llm-topic-output.interface';

export interface TopicCandidateView {
  id: string;
  taskId: string;
  title: string;
  rationale: string | null;
  keywords: string[];
  estimatedDifficulty: EstimatedDifficulty | null;
  isSelected: boolean;
  selectedAt: Date | null;
  generationBatch: number;
  createdAt: Date;
}
