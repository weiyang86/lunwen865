import { NotFoundException } from '@nestjs/common';
import { ExportScope } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';

export interface PaperSnapshot {
  title: string;
  author?: string;
  school?: string;
  major?: string;
  studentId?: string;
  advisor?: string;
  abstract?: string;
  keywords?: string[];
  abstractEn?: string;
  keywordsEn?: string[];
  outline: OutlineNode[];
  sections: SectionContent[];
  references: ReferenceItem[];
  revisions?: RevisionPair[];
}

export interface OutlineNode {
  level: 1 | 2 | 3;
  number: string;
  title: string;
  children?: OutlineNode[];
}

export interface SectionContent {
  level: 1 | 2 | 3;
  number: string;
  title: string;
  paragraphs: string[];
}

export interface ReferenceItem {
  index: number;
  text: string;
}

export interface RevisionPair {
  sectionTitle: string;
  original: string;
  revised: string;
  comment?: string;
}

function splitParagraphs(text: string | null | undefined): string[] {
  const raw = (text ?? '').replace(/\r\n/g, '\n').trim();
  if (!raw) return [];
  return raw
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

function buildOutlineTree(
  nodes: Array<{
    id: string;
    parentId: string | null;
    depth: number;
    orderIndex: number;
    title: string;
    numbering: string | null;
  }>,
): OutlineNode[] {
  const filtered = nodes
    .filter((n) => n.depth >= 1 && n.depth <= 3)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const byParent = new Map<string | null, typeof filtered>();
  for (const n of filtered) {
    const key = n.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(n);
    byParent.set(key, list);
  }

  const build = (parentId: string | null): OutlineNode[] => {
    const list = byParent.get(parentId) ?? [];
    return list.map((n) => {
      const children = build(n.id);
      return {
        level: (n.depth as 1 | 2 | 3) ?? 1,
        number: n.numbering ?? '',
        title: n.title,
        ...(children.length ? { children } : {}),
      };
    });
  };

  return build(null);
}

function parseNumberTokens(raw: string | null | undefined): number[] | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const parts = s.split('.').map((x) => x.trim());
  const tokens: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    tokens.push(Number(p));
  }
  return tokens.length ? tokens : null;
}

function compareNumbering(
  a: { numbering: string | null; orderIndex: number },
  b: { numbering: string | null; orderIndex: number },
): number {
  const ta = parseNumberTokens(a.numbering);
  const tb = parseNumberTokens(b.numbering);
  if (ta && tb) {
    const len = Math.min(ta.length, tb.length);
    for (let i = 0; i < len; i += 1) {
      const diff = ta[i] - tb[i];
      if (diff !== 0) return diff;
    }
    if (ta.length !== tb.length) return ta.length - tb.length;
  }
  return a.orderIndex - b.orderIndex;
}

function buildOrderedOutlineFlatList(
  nodes: Array<{
    id: string;
    parentId: string | null;
    depth: number;
    orderIndex: number;
    title: string;
    numbering: string | null;
  }>,
): Array<{
  id: string;
  parentId: string | null;
  depth: number;
  orderIndex: number;
  title: string;
  numbering: string | null;
}> {
  const filtered = nodes.filter((n) => n.depth >= 1 && n.depth <= 3).slice();

  const byParent = new Map<string | null, typeof filtered>();
  for (const n of filtered) {
    const key = n.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(n);
    byParent.set(key, list);
  }

  for (const [key, list] of byParent) {
    byParent.set(
      key,
      list.slice().sort((a, b) => compareNumbering(a, b)),
    );
  }

  const visited = new Set<string>();
  const out: typeof filtered = [];

  const walk = (parentId: string | null) => {
    const children = byParent.get(parentId) ?? [];
    for (const n of children) {
      if (visited.has(n.id)) continue;
      visited.add(n.id);
      out.push(n);
      walk(n.id);
    }
  };

  walk(null);

  const orphans = filtered.filter((n) => !visited.has(n.id));
  if (orphans.length) {
    orphans.sort((a, b) => compareNumbering(a, b));
    out.push(...orphans);
  }

  return out;
}

function formatReference(ref: {
  index: number;
  authors: string;
  title: string;
  year: number | null;
  journal: string | null;
  url: string | null;
}): string {
  const parts: string[] = [];
  if (ref.authors) parts.push(ref.authors);
  if (ref.title) parts.push(ref.title);
  if (ref.year) parts.push(String(ref.year));
  if (ref.journal) parts.push(ref.journal);
  if (ref.url) parts.push(ref.url);
  return parts.join('. ');
}

function clampLevel(depth: number): 1 | 2 | 3 {
  return Math.min(Math.max(depth, 1), 3) as 1 | 2 | 3;
}

function extractCitedIndicesFromText(text: string): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const regex = /\[(\d+)\]/g;
  for (const match of text.matchAll(regex)) {
    const n = Number(match[1]);
    if (!Number.isInteger(n) || n <= 0) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function replaceCitationsInText(
  text: string,
  mapping: Map<number, number>,
): string {
  return text.replace(/\[(\d+)\]/g, (m, raw) => {
    const n = Number(raw);
    const next = mapping.get(n);
    if (!next) return m;
    return `[${next}]`;
  });
}

function normalizeCitationsAndReferences(params: {
  sections: SectionContent[];
  referenceTextByIndex: Map<number, string>;
}): { sections: SectionContent[]; references: ReferenceItem[] } {
  const appearance: number[] = [];
  const seen = new Set<number>();

  for (const sec of params.sections) {
    for (const p of sec.paragraphs ?? []) {
      const indices = extractCitedIndicesFromText(p);
      for (const idx of indices) {
        if (seen.has(idx)) continue;
        seen.add(idx);
        appearance.push(idx);
      }
    }
  }

  if (appearance.length === 0) {
    const refs = [...params.referenceTextByIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([index, text]) => ({ index, text }));
    return { sections: params.sections, references: refs };
  }

  const mapping = new Map<number, number>();
  appearance.forEach((oldIndex, i) => mapping.set(oldIndex, i + 1));

  const sections = params.sections.map((sec) => ({
    ...sec,
    paragraphs: (sec.paragraphs ?? []).map((p) =>
      replaceCitationsInText(p, mapping),
    ),
  }));

  const references: ReferenceItem[] = appearance.map((oldIndex, i) => {
    const text =
      params.referenceTextByIndex.get(oldIndex) ??
      `待补充文献（原引用序号 ${oldIndex}）`;
    return { index: i + 1, text };
  });

  return { sections, references };
}

function pickBestWritingSession(
  sessions: Array<{
    status: string;
    completedCount: number;
    totalSections: number;
    createdAt: Date;
    sections: Array<{
      outlineNodeId: string;
      orderIndex: number;
      title: string;
      rawContent: string | null;
      editedContent: string | null;
      outlineNode: { depth: number; numbering: string | null };
    }>;
  }>,
): (typeof sessions)[number] | null {
  if (!sessions.length) return null;

  const score = (s: (typeof sessions)[number]) => {
    const status = String(s.status);
    const statusScore =
      status === 'SUCCESS'
        ? 3
        : status === 'RUNNING'
          ? 2
          : status === 'FAILED'
            ? 1
            : 0;
    const completionScore =
      s.totalSections > 0 ? s.completedCount / s.totalSections : 0;
    return statusScore * 1000 + completionScore * 100 + s.sections.length;
  };

  return sessions.slice().sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  })[0];
}

export async function buildSnapshot(
  prisma: PrismaService,
  params: { paperId?: string; polishTaskId?: string; scope: ExportScope },
): Promise<PaperSnapshot> {
  const scope = params.scope;

  if (params.polishTaskId) {
    const polish = await prisma.polishTask.findUnique({
      where: { id: params.polishTaskId },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            school: { select: { name: true } },
            major: true,
            educationLevel: true,
            user: { select: { realName: true, nickname: true } },
          },
        },
        segments: { orderBy: { segmentIndex: 'asc' } },
      },
    });
    if (!polish) throw new NotFoundException('找不到导出来源');

    const title = polish.task?.title ?? polish.title ?? '未命名论文';
    const author =
      polish.task?.user?.realName ?? polish.task?.user?.nickname ?? undefined;

    const outline: OutlineNode[] = [];
    const sections: SectionContent[] =
      scope === ExportScope.OUTLINE_ONLY
        ? []
        : [
            {
              level: 1,
              number: '',
              title: '正文',
              paragraphs: splitParagraphs(
                polish.polishedText ?? polish.originalText,
              ),
            },
          ];

    const revisions: RevisionPair[] | undefined =
      scope === ExportScope.WITH_REVISIONS
        ? polish.segments.map((s) => ({
            sectionTitle: `段落 ${s.segmentIndex + 1}`,
            original: s.originalText,
            revised: s.polishedText ?? '',
          }))
        : undefined;

    return {
      title,
      author,
      school: polish.task?.school?.name ?? undefined,
      major: polish.task?.major ?? undefined,
      outline,
      sections,
      references: [],
      revisions,
    };
  }

  if (params.paperId) {
    const task = await prisma.task.findUnique({
      where: { id: params.paperId },
      include: {
        school: { select: { name: true } },
        user: { select: { realName: true, nickname: true } },
        abstracts: { orderBy: { version: 'desc' }, take: 1 },
        outline: {
          include: {
            nodes: {
              select: {
                id: true,
                parentId: true,
                depth: true,
                orderIndex: true,
                title: true,
                numbering: true,
              },
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        writingSessions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            sections: {
              orderBy: { orderIndex: 'asc' },
              include: {
                outlineNode: { select: { depth: true, numbering: true } },
              },
            },
          },
        },
        references: { orderBy: { index: 'asc' } },
      },
    });
    if (!task) throw new NotFoundException('找不到导出来源');

    const outlineNodes = task.outline?.nodes ?? [];
    const outline = buildOutlineTree(outlineNodes);

    const session = pickBestWritingSession(task.writingSessions ?? []);
    const sections: SectionContent[] =
      scope === ExportScope.OUTLINE_ONLY
        ? []
        : (() => {
            const sectionMap = new Map<
              string,
              {
                title: string;
                content: string;
                depth: number;
                numbering: string | null;
              }
            >();

            for (const s of session?.sections ?? []) {
              sectionMap.set(s.outlineNodeId, {
                title: s.title,
                content: s.editedContent ?? s.rawContent ?? '',
                depth: s.outlineNode.depth,
                numbering: s.outlineNode.numbering ?? null,
              });
            }

            const filteredNodes = outlineNodes.filter(
              (n) => n.depth >= 1 && n.depth <= 3,
            );
            const nodeIdSet = new Set(filteredNodes.map((n) => n.id));
            const parentHasChild = new Set<string>();
            for (const n of filteredNodes) {
              if (!n.parentId) continue;
              if (!nodeIdSet.has(n.parentId)) continue;
              parentHasChild.add(n.parentId);
            }

            const nodes = buildOrderedOutlineFlatList(outlineNodes);

            return nodes.map((n, idx) => {
              const hit = sectionMap.get(n.id);
              const content = hit?.content ?? '';
              const paragraphs = splitParagraphs(content);
              const isLeaf = !parentHasChild.has(n.id);
              return {
                level: clampLevel(n.depth),
                number: n.numbering ?? hit?.numbering ?? String(idx + 1),
                title: n.title || hit?.title || '未命名章节',
                paragraphs:
                  paragraphs.length > 0
                    ? paragraphs
                    : isLeaf
                      ? ['（本节内容尚未生成，可在“正文生成”继续生成后再导出）']
                      : [],
              };
            });
          })();

    const referenceTextByIndex = new Map<number, string>();
    for (const r of task.references ?? []) {
      referenceTextByIndex.set(
        r.index,
        formatReference({
          index: r.index,
          authors: r.authors,
          title: r.title,
          year: r.year ?? null,
          journal: r.journal ?? null,
          url: r.url ?? null,
        }),
      );
    }

    const normalized = normalizeCitationsAndReferences({
      sections,
      referenceTextByIndex,
    });

    const abs = task.abstracts?.[0] ?? null;
    return {
      title: task.title ?? '未命名论文',
      author: task.user.realName ?? task.user.nickname ?? undefined,
      school: task.school.name,
      major: task.major ?? undefined,
      abstract: abs?.abstractZh ?? undefined,
      abstractEn: abs?.abstractEn ?? undefined,
      outline,
      sections: normalized.sections,
      references: normalized.references,
    };
  }

  throw new NotFoundException('找不到导出来源');
}
