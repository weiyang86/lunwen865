/**
 * 聚合流式输出为完整文本
 */
export async function aggregateStream(
  stream: AsyncIterable<string>,
): Promise<{ content: string }> {
  let content = '';
  for await (const chunk of stream) {
    content += chunk;
  }
  return { content };
}

/**
 * 截取摘要（取前 N 个字符）
 */
export function buildSummary(text: string, maxChars: number): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars);
}
