function splitKeepDelimiter(text: string, delimiter: RegExp): string[] {
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const re = new RegExp(
    delimiter.source,
    delimiter.flags.includes('g') ? delimiter.flags : `${delimiter.flags}g`,
  );
  re.lastIndex = 0;

  while ((match = re.exec(text)) !== null) {
    const end = match.index + match[0].length;
    parts.push(text.slice(lastIndex, end));
    lastIndex = end;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  if (parts.length === 0) return [text];
  return parts;
}

function splitBySentences(text: string): string[] {
  const pieces = splitKeepDelimiter(text, /[。！？.!?]+/g);
  return pieces.filter((x) => x.length > 0);
}

function forceChunk(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return chunks;
}

export function segmentText(text: string, maxLen: number = 800): string[] {
  const raw = text ?? '';
  if (raw.length <= maxLen && !/\n{2,}/.test(raw)) return [raw];

  const paragraphParts = splitKeepDelimiter(raw, /\n{2,}/g);
  const segments: string[] = [];

  for (const part of paragraphParts) {
    if (part.length <= maxLen) {
      segments.push(part);
      continue;
    }

    const sentences = splitBySentences(part);
    let buf = '';
    for (const s of sentences) {
      if ((buf + s).length <= maxLen) {
        buf += s;
        continue;
      }

      if (buf) {
        segments.push(buf);
        buf = '';
      }

      if (s.length <= maxLen) {
        buf = s;
      } else {
        const chunks = forceChunk(s, maxLen);
        segments.push(...chunks.slice(0, -1));
        buf = chunks[chunks.length - 1] ?? '';
      }
    }
    if (buf) segments.push(buf);
  }

  return segments.length > 0 ? segments : [raw];
}
