const REF_PATTERN = /\[REF:([A-Za-z0-9_]+)\]/g;

/**
 * 提取正文中的引用占位符 KEY（去重且保序）
 */
export function extractRefKeys(content: string): string[] {
  if (!content) return [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const match of content.matchAll(REF_PATTERN)) {
    const key = match[1];
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }

  return out;
}
