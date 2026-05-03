import { GenerationStage } from '../constants/generation-stage.enum';

const STAGE_PROGRESS_MAP: Record<GenerationStage, number> = {
  [GenerationStage.INIT]: 0,
  [GenerationStage.TOPIC]: 5,
  [GenerationStage.OPENING]: 15,
  [GenerationStage.OUTLINE]: 25,
  [GenerationStage.CHAPTER]: 25,
  [GenerationStage.SECTION]: 75,
  [GenerationStage.SUMMARY]: 90,
  [GenerationStage.POLISHING]: 95,
  [GenerationStage.DONE]: 100,
};

function clampProgress(value: number, stage: GenerationStage): number {
  const floored = Math.floor(value);
  if (stage === GenerationStage.DONE) return 100;
  return Math.max(0, Math.min(99, floored));
}

/**
 * 综合计算进度
 * @param stage 当前阶段
 * @param chapterStats { total, completed }
 * @param sectionStats { total, completed }
 */
export function calculateProgress(
  stage: GenerationStage,
  chapterStats?: { total: number; completed: number },
  sectionStats?: { total: number; completed: number },
): number {
  if (stage === GenerationStage.DONE) return 100;

  if (stage === GenerationStage.CHAPTER) {
    const base = STAGE_PROGRESS_MAP[GenerationStage.CHAPTER];
    const total = chapterStats?.total ?? 0;
    const completed = chapterStats?.completed ?? 0;
    if (total <= 0) return clampProgress(base, stage);
    const ratio = Math.max(0, Math.min(1, completed / total));
    return clampProgress(base + ratio * 50, stage);
  }

  if (stage === GenerationStage.SECTION) {
    const base = STAGE_PROGRESS_MAP[GenerationStage.SECTION];
    const total = sectionStats?.total ?? 0;
    const completed = sectionStats?.completed ?? 0;
    if (total <= 0) return clampProgress(base, stage);
    const ratio = Math.max(0, Math.min(1, completed / total));
    return clampProgress(base + ratio * 15, stage);
  }

  const base = STAGE_PROGRESS_MAP[stage] ?? 0;
  return clampProgress(base, stage);
}
