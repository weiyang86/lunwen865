export function extractCitedIndices(content: string): number[] {
  const result: number[] = [];
  const seen = new Set<number>();
  const regex = /\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const n = Number(match[1]);
    if (!Number.isInteger(n) || n <= 0) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    result.push(n);
  }
  return result;
}

export function replaceCitations(
  content: string,
  mapping: Map<number, number>,
): string {
  return content.replace(/\[(\d+)\]/g, (m, raw) => {
    const n = Number(raw);
    const next = mapping.get(n);
    if (!next) return m;
    return `[${next}]`;
  });
}

export function removeCitation(content: string, index: number): string {
  const escaped = String(index).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const out = content.replace(new RegExp(`\\[${escaped}\\]`, 'g'), '');
  return out.replace(/\s+/g, ' ').trim();
}
