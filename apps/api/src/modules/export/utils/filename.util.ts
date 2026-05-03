export function sanitizeFilename(input: string): string {
  const raw = (input ?? '').trim();
  if (!raw) return '';

  let removed = raw.replace(/[/\\:*?"<>|]/g, '');
  removed = [...removed]
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code >= 32 && code !== 127;
    })
    .join('');

  const allowed = removed.replace(/[^\p{L}\p{N}_\-\s]/gu, '');
  const collapsed = allowed.replace(/\s+/g, ' ').trim();
  return collapsed.length > 100 ? collapsed.slice(0, 100) : collapsed;
}
