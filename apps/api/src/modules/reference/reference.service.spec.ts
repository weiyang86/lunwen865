import type { Reference } from '@prisma/client';
import { formatGBT7714 } from './formatters/gbt7714.formatter';
import {
  extractCitedIndices,
  removeCitation,
  replaceCitations,
} from './utils/citation.util';

function baseRef(overrides: Partial<Reference>): Reference {
  const now = new Date('2026-04-27T00:00:00.000Z');
  return {
    id: 'ref_1',
    taskId: 'task_1',
    index: 1,
    type: 'JOURNAL',
    title: '论文标题',
    authors: '张三, 李四',
    year: 2023,
    journal: null,
    volume: null,
    issue: null,
    pages: null,
    publisher: null,
    city: null,
    university: null,
    degree: null,
    url: null,
    accessDate: null,
    doi: null,
    isbn: null,
    source: 'AI_GENERATED',
    verified: false,
    citedInSections: [],
    citedCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('ReferenceModule', () => {
  describe('formatGBT7714', () => {
    it('formats JOURNAL', () => {
      const ref = baseRef({
        type: 'JOURNAL',
        journal: '计算机学报',
        volume: '46',
        issue: '3',
        pages: '456-470',
      });
      expect(formatGBT7714(ref)).toBe(
        '[1] 张三, 李四. 论文标题[J]. 计算机学报, 2023, 46(3): 456-470.',
      );
    });

    it('formats BOOK', () => {
      const ref = baseRef({
        index: 2,
        type: 'BOOK',
        title: '书名',
        authors: '王五',
        city: '北京',
        publisher: '清华大学出版社',
        year: 2022,
        pages: '100-120',
      });
      expect(formatGBT7714(ref)).toBe(
        '[2] 王五. 书名[M]. 北京: 清华大学出版社, 2022: 100-120.',
      );
    });

    it('formats THESIS', () => {
      const ref = baseRef({
        index: 3,
        type: 'THESIS',
        title: '论文题目',
        authors: '赵六',
        university: '北京大学',
        year: 2021,
      });
      expect(formatGBT7714(ref)).toBe('[3] 赵六. 论文题目[D]. 北京大学, 2021.');
    });

    it('formats WEB', () => {
      const ref = baseRef({
        index: 4,
        type: 'WEB',
        authors: 'XX机构',
        title: '标题',
        url: 'https://xxx.com',
        year: 2023,
        accessDate: new Date('2024-01-15T00:00:00.000Z'),
      });
      expect(formatGBT7714(ref)).toBe(
        '[4] XX机构. 标题[EB/OL]. (2023-01-01)[2024-01-15]. https://xxx.com.',
      );
    });
  });

  describe('citation utils', () => {
    it('extracts unique indices by appearance', () => {
      expect(extractCitedIndices('a[2]b[10]c[2]d[1]')).toEqual([2, 10, 1]);
    });

    it('replaces citations with a mapping', () => {
      const mapping = new Map<number, number>([
        [2, 1],
        [10, 3],
      ]);
      expect(replaceCitations('a[2]b[10]c[2]', mapping)).toBe('a[1]b[3]c[1]');
    });

    it('removes a citation marker', () => {
      expect(removeCitation('a [2] b [10] c', 2)).toBe('a b [10] c');
    });
  });
});
