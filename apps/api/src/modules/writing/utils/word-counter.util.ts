/**
 * 统计中英文混合文本的字数：
 * - 中文按字符数计数（常用汉字区间）
 * - 英文按单词数计数（连续字母/数字视为一个词）
 */
export function countWords(text: string): number {
  if (!text) return 0;

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return 0;

  const cjkMatches = normalized.match(/[\u4e00-\u9fff]/g);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  const latinMatches = normalized.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g);
  const latinCount = latinMatches ? latinMatches.length : 0;

  return cjkCount + latinCount;
}
