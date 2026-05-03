import { Injectable } from '@nestjs/common';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function splitSentences(text: string): string[] {
  const parts = text
    .replace(/\r\n/g, '\n')
    .split(/(?<=[。！？.!?])\s*/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v =
    values.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / values.length;
  return v;
}

@Injectable()
export class AiDetectorService {
  detect(text: string): Promise<number> {
    const t = (text ?? '').trim();
    if (!t) return Promise.resolve(0);

    const sentences = splitSentences(t);
    const lengths = sentences.map((s) => s.length);

    const longRatio =
      lengths.filter((n) => n >= 45).length / Math.max(lengths.length, 1);

    const connectors = [
      '首先',
      '其次',
      '最后',
      '综上所述',
      '因此',
      '此外',
      '同时',
      '进一步',
      '总之',
    ];
    const connectorHits = connectors.reduce((acc, w) => {
      const re = new RegExp(w, 'g');
      const m = t.match(re);
      return acc + (m ? m.length : 0);
    }, 0);
    const connectorDensity = connectorHits / Math.max(t.length / 200, 1);

    const lenVar = variance(lengths);
    const varScore = 1 - clamp(lenVar / 800, 0, 1);

    const tokens = tokenize(t);
    const freq = new Map<string, number>();
    for (const tok of tokens) {
      freq.set(tok, (freq.get(tok) ?? 0) + 1);
    }
    const repeated = [...freq.values()].filter((n) => n >= 4).length;
    const repeatScore = clamp(repeated / 12, 0, 1);

    const score =
      100 *
      clamp(
        0.25 * longRatio +
          0.42 * clamp(connectorDensity / 1.9, 0, 1) +
          0.2 * varScore +
          0.15 * repeatScore,
        0,
        1,
      );

    return Promise.resolve(Number(score.toFixed(2)));
  }
}
