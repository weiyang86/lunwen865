import { Injectable } from '@nestjs/common';
import type {
  ResolveAllResult,
  ResolvedSection,
  ReferenceItem,
} from '../interfaces/reference.interface';
import { extractRefKeys } from '../utils/ref-extractor.util';

function replaceRefPlaceholders(
  content: string,
  keyToIndex: Map<string, number>,
): string {
  return content.replace(/\[REF:([A-Za-z0-9_]+)\]/g, (match, rawKey) => {
    const key = typeof rawKey === 'string' ? rawKey : '';
    const index = keyToIndex.get(key);
    if (!index) return match;
    return `[${index}]`;
  });
}

@Injectable()
export class ReferenceResolverService {
  resolveAll(
    sections: Array<{ id: string; content: string }>,
  ): ResolveAllResult {
    const orderedKeys: string[] = [];
    const seen = new Set<string>();

    for (const section of sections) {
      const keys = extractRefKeys(section.content);
      for (const k of keys) {
        if (seen.has(k)) continue;
        seen.add(k);
        orderedKeys.push(k);
      }
    }

    const keyToIndex = new Map<string, number>();
    orderedKeys.forEach((k, i) => keyToIndex.set(k, i + 1));

    const resolvedSections: ResolvedSection[] = sections.map((s) => ({
      id: s.id,
      resolvedContent: replaceRefPlaceholders(s.content, keyToIndex),
    }));

    const references: ReferenceItem[] = orderedKeys.map((k, i) => ({
      key: k,
      index: i + 1,
      placeholder: `[${i + 1}]`,
    }));

    return { resolvedSections, references };
  }
}
