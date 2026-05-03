import { GenerationStage } from '../constants/generation-stage.enum';

export const STAGE_ORDER: GenerationStage[] = [
  GenerationStage.INIT,
  GenerationStage.TOPIC,
  GenerationStage.OPENING,
  GenerationStage.OUTLINE,
  GenerationStage.CHAPTER,
  GenerationStage.SECTION,
  GenerationStage.SUMMARY,
  GenerationStage.POLISHING,
  GenerationStage.DONE,
];

export function getStageIndex(stage: GenerationStage): number {
  const index = STAGE_ORDER.indexOf(stage);
  return index >= 0 ? index : -1;
}

export function canAdvanceTo(
  current: GenerationStage,
  target: GenerationStage,
): boolean {
  const currentIndex = getStageIndex(current);
  const targetIndex = getStageIndex(target);
  if (currentIndex < 0 || targetIndex < 0) return false;
  return targetIndex >= currentIndex;
}

export function isStageBeforeOrEqual(
  a: GenerationStage,
  b: GenerationStage,
): boolean {
  return canAdvanceTo(a, b);
}
