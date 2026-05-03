export class PolishSegmentDiffDto {
  index!: number;
  original!: string;
  polished!: string;
  changeRatio!: number;
}

export class PolishDiffResultDto {
  taskId!: string;
  totalSegments!: number;
  avgChangeRatio!: number;
  aiScoreBefore!: number | null;
  aiScoreAfter!: number | null;
  segments!: PolishSegmentDiffDto[];
}

export class PolishStatsDto {
  totalTasks!: number;
  successTasks!: number;
  failedTasks!: number;
  totalWordsProcessed!: number;
  totalWordsThisMonth!: number;
  avgAiScoreReduction!: number;
  byStrength!: Record<string, number>;
}
