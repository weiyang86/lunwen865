type OutlineNodeForNumbering = {
  id: string;
  path: string;
  depth: number;
};

function parseSegments(path: string): number[] {
  const parts = path.split('/').filter((x) => x.length > 0);
  if (parts.length === 0) return [];
  return parts.map((p) => {
    if (!/^\d{4}$/.test(p)) {
      throw new Error(`Invalid path segment: ${p}`);
    }
    const n = Number.parseInt(p, 10);
    if (!Number.isFinite(n)) throw new Error(`Invalid path number: ${p}`);
    return n;
  });
}

function toChineseNumber(n: number): string {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (!Number.isInteger(n) || n <= 0 || n > 99) {
    throw new Error(`Unsupported chapter number: ${n}`);
  }
  if (n < 10) return digits[n];
  if (n === 10) return '十';
  if (n < 20) return `十${digits[n % 10]}`;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? `${digits[tens]}十` : `${digits[tens]}十${digits[ones]}`;
}

/**
 * 根据 path 和 depth 计算 numbering
 * depth=1（章）：使用中文数字 "第一章"、"第二章"
 * depth=2（节）：使用 "1.1"、"1.2"
 * depth=3（小节）：使用 "1.1.1"
 * depth=4：使用 "(1)"、"(2)"
 *
 * 注意：numbering 在生成、新增、删除、移动、重排序后都需要重算
 * 实现策略：批量重算，不在节点级实时计算
 */
export function computeNumbering(
  allNodes: OutlineNodeForNumbering[],
): Map<string, string> {
  const result = new Map<string, string>();

  for (const node of allNodes) {
    const segs = parseSegments(node.path);
    if (segs.length < node.depth) {
      throw new Error(
        `Path depth mismatch: depth=${node.depth} path=${node.path}`,
      );
    }

    const idx = segs[node.depth - 1] + 1;
    const chapterNo = segs[0] + 1;

    if (node.depth === 1) {
      result.set(node.id, `第${toChineseNumber(idx)}章`);
      continue;
    }

    if (node.depth === 2) {
      result.set(node.id, `${chapterNo}.${idx}`);
      continue;
    }

    if (node.depth === 3) {
      const sectionNo = segs[1] + 1;
      result.set(node.id, `${chapterNo}.${sectionNo}.${idx}`);
      continue;
    }

    if (node.depth === 4) {
      result.set(node.id, `(${idx})`);
      continue;
    }
  }

  return result;
}
