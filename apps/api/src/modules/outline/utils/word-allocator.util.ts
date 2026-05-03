import {
  OUTLINE_LOCK_WORDCOUNT_MAX_RATIO,
  OUTLINE_LOCK_WORDCOUNT_MIN_RATIO,
} from '../constants/outline.constants';
import type {
  WordAllocationLeafInput,
  WordCountValidationResult,
} from '../interfaces/word-allocation.interface';

/**
 * 字数归一化：把 LLM 返回的 expectedWords 总和归一到 target
 * 1. 计算所有叶子节点 expectedWords 之和 sum
 * 2. 比例 ratio = target / sum
 * 3. 每个叶子 newWords = round(words * ratio)
 * 4. 因 round 累计误差，把误差 delta 加到字数最大的那个节点上
 * 5. 保证：所有叶子之和 === target
 */
export function normalizeWordCount(
  leaves: WordAllocationLeafInput[],
  target: number,
): Map<string, number> {
  if (!Number.isInteger(target) || target <= 0) {
    throw new Error(`Invalid target: ${target}`);
  }

  if (leaves.length === 0) {
    throw new Error('No leaves provided');
  }

  let sum = 0;
  for (const leaf of leaves) {
    if (!leaf.id) throw new Error('Leaf id is required');
    if (!Number.isInteger(leaf.expectedWords) || leaf.expectedWords < 0) {
      throw new Error(`Invalid expectedWords: ${leaf.expectedWords}`);
    }
    sum += leaf.expectedWords;
  }

  if (sum <= 0) {
    throw new Error('Leaf expectedWords sum must be > 0');
  }

  const ratio = target / sum;
  const result = new Map<string, number>();

  let newSum = 0;
  let maxId = leaves[0].id;
  let maxWords = -1;

  for (const leaf of leaves) {
    const newWords = Math.round(leaf.expectedWords * ratio);
    result.set(leaf.id, newWords);
    newSum += newWords;

    if (newWords > maxWords) {
      maxWords = newWords;
      maxId = leaf.id;
    }
  }

  const delta = target - newSum;
  if (delta !== 0) {
    const current = result.get(maxId) ?? 0;
    const adjusted = current + delta;
    if (adjusted < 0) {
      throw new Error('Normalization produced negative expectedWords');
    }
    result.set(maxId, adjusted);
  }

  let verifySum = 0;
  for (const value of result.values()) verifySum += value;
  if (verifySum !== target) {
    throw new Error(`Normalization mismatch: ${verifySum} !== ${target}`);
  }

  return result;
}

/**
 * 校验大纲字数（lock 时调用）
 * 在 [target * 0.85, target * 1.15] 内为合法
 */
export function validateWordCount(
  total: number,
  target: number,
): WordCountValidationResult {
  if (!Number.isFinite(total) || !Number.isFinite(target) || target <= 0) {
    return { valid: false, reason: 'total/target 不合法' };
  }

  const min = Math.floor(target * OUTLINE_LOCK_WORDCOUNT_MIN_RATIO);
  const max = Math.ceil(target * OUTLINE_LOCK_WORDCOUNT_MAX_RATIO);

  if (total < min) {
    return {
      valid: false,
      reason: `总字数过少：${total} < ${min}`,
    };
  }

  if (total > max) {
    return {
      valid: false,
      reason: `总字数过多：${total} > ${max}`,
    };
  }

  return { valid: true };
}
