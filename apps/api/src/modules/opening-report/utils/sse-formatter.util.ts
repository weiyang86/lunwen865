/**
 * 格式化 SSE 事件
 * 注意：data 必须是单行 JSON（依赖 JSON.stringify 自动转义换行）
 */
export function formatSseEvent(event: string, data: unknown): string {
  const dataStr = JSON.stringify(data);
  return `event: ${event}\ndata: ${dataStr}\n\n`;
}
