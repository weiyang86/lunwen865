/**
 * 提取上一节末尾摘要（用于跨节连贯性）
 * - 先压缩空白为单空格
 * - 再按字符截取末尾 maxChars
 */
export function summarizeTail(text: string, maxChars: number): string {
  if (!text) return '';
  if (!Number.isInteger(maxChars) || maxChars <= 0) return '';

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const chars = Array.from(normalized);
  if (chars.length <= maxChars) return normalized;
  return chars.slice(chars.length - maxChars).join('');
}
