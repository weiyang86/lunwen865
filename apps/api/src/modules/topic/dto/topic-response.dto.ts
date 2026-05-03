import type { EstimatedDifficulty } from '../interfaces/llm-topic-output.interface';

export class TopicResponseDto {
  id!: string;
  taskId!: string;
  title!: string;
  rationale!: string | null;
  keywords!: string[];
  estimatedDifficulty!: EstimatedDifficulty | null;
  isSelected!: boolean;
  selectedAt!: Date | null;
  generationBatch!: number;
  createdAt!: Date;
}
