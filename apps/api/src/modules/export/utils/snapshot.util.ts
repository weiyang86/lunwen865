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
          take: 1,
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

    const session = task.writingSessions?.[0] ?? null;
    const sections: SectionContent[] =
      scope === ExportScope.OUTLINE_ONLY
        ? []
        : (session?.sections ?? []).map((s, idx) => {
            const level = Math.min(Math.max(s.outlineNode.depth, 1), 3) as
              | 1
              | 2
              | 3;
            const number = s.outlineNode.numbering ?? String(idx + 1);
            const content = s.editedContent ?? s.rawContent ?? '';
            return {
              level,
              number,
              title: s.title,
              paragraphs: splitParagraphs(content),
            };
          });

    const references: ReferenceItem[] = (task.references ?? []).map((r) => ({
      index: r.index,
      text: formatReference({
        index: r.index,
        authors: r.authors,
        title: r.title,
        year: r.year ?? null,
        journal: r.journal ?? null,
        url: r.url ?? null,
      }),
    }));

    return {
      title: task.title ?? '未命名论文',
      author: task.user.realName ?? task.user.nickname ?? undefined,
      school: task.school.name,
      major: task.major ?? undefined,
      outline,
      sections,
      references,
    };
  }

  throw new NotFoundException('找不到导出来源');
}
