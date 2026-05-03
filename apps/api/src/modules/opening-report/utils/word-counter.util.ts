/**
 * 中英文混合字数统计
 * 中文按字符计，英文按单词计
 */
export function countWords(text: string): number {
  if (!text) return 0;

  const cleaned = text
    .replace(/[#*`>-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 0;

  const chineseChars = (cleaned.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (cleaned.match(/[a-zA-Z]+/g) || []).length;

  return chineseChars + englishWords;
}
