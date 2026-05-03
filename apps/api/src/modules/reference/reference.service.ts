import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RefSource, RefType, type Reference } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { summarizeTail } from '../writing/utils/content-summarizer.util';
import { WritingService } from '../writing/services/writing.service';
import type { CreateReferenceDto } from './dto/create-reference.dto';
import type { UpdateReferenceDto } from './dto/update-reference.dto';
import { formatGBT7714 } from './formatters/gbt7714.formatter';
import {
  buildReferenceGenerationPrompt,
  type ReferenceGenerationContext,
} from './prompts/reference-generation.prompt';
import {
  extractCitedIndices,
  removeCitation,
  replaceCitations,
} from './utils/citation.util';

const REFERENCE_GENERATION_SCHEMA = z.object({
  references: z.array(
    z.object({
      type: z.enum([
        'JOURNAL',
        'BOOK',
        'THESIS',
        'CONFERENCE',
        'STANDARD',
        'PATENT',
        'WEB',
        'NEWSPAPER',
        'REPORT',
      ]),
      title: z.string().min(1),
      authors: z.string().min(1),
      year: z.number().int().min(1900).max(2100).optional(),
      journal: z.string().optional(),
      volume: z.string().optional(),
      issue: z.string().optional(),
      pages: z.string().optional(),
      publisher: z.string().optional(),
      city: z.string().optional(),
      university: z.string().optional(),
      degree: z.string().optional(),
      url: z.string().optional(),
      accessDate: z.string().optional(),
      doi: z.string().optional(),
      isbn: z.string().optional(),
    }),
  ),
});

function parseAccessDate(input: string | undefined): Date | null {
  if (!input) return null;
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class ReferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly writing: WritingService,
  ) {}

  async list(taskId: string): Promise<Reference[]> {
    return this.prisma.reference.findMany({
      where: { taskId },
      orderBy: { index: 'asc' },
    });
  }

  async listFormatted(taskId: string, style?: string) {
    const st = (style ?? 'gbt7714').toLowerCase();
    if (st !== 'gbt7714') {
      throw new BadRequestException('仅支持 style=gbt7714');
    }
    const refs = await this.list(taskId);
    return refs.map((r) => formatGBT7714(r));
  }

  async findById(taskId: string, id: string): Promise<Reference> {
    const ref = await this.prisma.reference.findUnique({ where: { id } });
    if (!ref || ref.taskId !== taskId) {
      throw new NotFoundException(`文献不存在（id=${id}）`);
    }
    return ref;
  }

  async create(taskId: string, dto: CreateReferenceDto): Promise<Reference> {
    const index = dto.index ?? (await this.getNextIndex(taskId));
    return this.prisma.reference.create({
      data: {
        taskId,
        index,
        type: dto.type,
        title: dto.title,
        authors: dto.authors,
        year: dto.year ?? null,
        journal: dto.journal ?? null,
        volume: dto.volume ?? null,
        issue: dto.issue ?? null,
        pages: dto.pages ?? null,
        publisher: dto.publisher ?? null,
        city: dto.city ?? null,
        university: dto.university ?? null,
        degree: dto.degree ?? null,
        url: dto.url ?? null,
        accessDate: parseAccessDate(dto.accessDate),
        doi: dto.doi ?? null,
        isbn: dto.isbn ?? null,
        source: dto.source ?? RefSource.MANUAL,
        verified: dto.verified ?? false,
        citedInSections: [],
        citedCount: 0,
      },
    });
  }

  async update(
    taskId: string,
    id: string,
    dto: UpdateReferenceDto,
  ): Promise<Reference> {
    const existing = await this.findById(taskId, id);

    if (dto.index !== undefined) {
      const conflict = await this.prisma.reference.findUnique({
        where: { taskId_index: { taskId, index: dto.index } },
      });
      if (conflict && conflict.id !== id) {
        throw new BadRequestException(`index 已被占用（index=${dto.index}）`);
      }
    }

    return this.prisma.reference.update({
      where: { id: existing.id },
      data: {
        index: dto.index,
        type: dto.type,
        title: dto.title,
        authors: dto.authors,
        year: dto.year ?? undefined,
        journal: dto.journal,
        volume: dto.volume,
        issue: dto.issue,
        pages: dto.pages,
        publisher: dto.publisher,
        city: dto.city,
        university: dto.university,
        degree: dto.degree,
        url: dto.url,
        accessDate: dto.accessDate
          ? parseAccessDate(dto.accessDate)
          : undefined,
        doi: dto.doi,
        isbn: dto.isbn,
        source: dto.source,
        verified: dto.verified,
      },
    });
  }

  async generateFromContent(
    taskId: string,
    count = 15,
    recentYears = 5,
  ): Promise<Reference[]> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`任务不存在（taskId=${taskId}）`);

    const outline = await this.prisma.outline.findUnique({
      where: { taskId },
      include: { nodes: { orderBy: { path: 'asc' } } },
    });
    const outlineTitles = outline
      ? outline.nodes.map((n) => n.title).slice(0, 60)
      : [];

    const latestSession = await this.prisma.writingSession.findFirst({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: { sections: { orderBy: { orderIndex: 'asc' } } },
    });

    const sectionContents =
      latestSession?.sections
        .map((s) => s.editedContent ?? s.rawContent ?? '')
        .filter(Boolean) ?? [];

    const snippets = sectionContents
      .slice(0, 5)
      .map((t) => summarizeTail(t, 800))
      .filter(Boolean);

    const cited = sectionContents.flatMap((t) => extractCitedIndices(t));
    const appearance = this.uniqueByAppearance(cited);
    const desiredCount = Math.max(appearance.length, count);
    const desiredIndices =
      appearance.length > 0
        ? appearance.slice(0, desiredCount)
        : Array.from({ length: desiredCount }, (_, i) => i + 1);

    const ctx: ReferenceGenerationContext = {
      title: task.title ?? '',
      outlineTitles,
      contentSnippets: snippets,
      count: desiredIndices.length,
      recentYears,
      languageHint: { zhRatio: 0.8, enRatio: 0.2 },
      typeDistribution: [
        { type: RefType.JOURNAL, ratio: 0.6 },
        { type: RefType.BOOK, ratio: 0.2 },
        { type: RefType.THESIS, ratio: 0.1 },
        { type: RefType.WEB, ratio: 0.1 },
      ],
    };

    const prompt = buildReferenceGenerationPrompt(ctx);
    const generated = await this.llm.generateJson(
      prompt,
      REFERENCE_GENERATION_SCHEMA,
      { taskId, stage: 'SUMMARY', temperature: 0.2, maxTokens: 4096 },
    );

    const refs = generated.references.slice(0, desiredIndices.length);

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < desiredIndices.length; i += 1) {
        const index = desiredIndices[i];
        const item = refs[i];
        const fallback = {
          type: 'WEB' as const,
          title: `待补充文献 ${index}`,
          authors: '未知',
        };
        const data = item ?? fallback;

        const createData: Prisma.ReferenceCreateInput = {
          task: { connect: { id: taskId } },
          index,
          type: data.type,
          title: data.title,
          authors: data.authors,
          year: data.year ?? null,
          journal: data.journal ?? null,
          volume: data.volume ?? null,
          issue: data.issue ?? null,
          pages: data.pages ?? null,
          publisher: data.publisher ?? null,
          city: data.city ?? null,
          university: data.university ?? null,
          degree: data.degree ?? null,
          url: data.url ?? null,
          accessDate: parseAccessDate(data.accessDate),
          doi: data.doi ?? null,
          isbn: data.isbn ?? null,
          source: RefSource.AI_GENERATED,
          verified: false,
          citedInSections: [],
          citedCount: 0,
        };

        await tx.reference.upsert({
          where: { taskId_index: { taskId, index } },
          create: createData,
          update: {
            type: createData.type,
            title: createData.title,
            authors: createData.authors,
            year: createData.year,
            journal: createData.journal,
            volume: createData.volume,
            issue: createData.issue,
            pages: createData.pages,
            publisher: createData.publisher,
            city: createData.city,
            university: createData.university,
            degree: createData.degree,
            url: createData.url,
            accessDate: createData.accessDate,
            doi: createData.doi,
            isbn: createData.isbn,
            source: RefSource.AI_GENERATED,
            verified: false,
          },
        });
      }
    });

    await this.syncCitationsFromContent(taskId);
    return this.list(taskId);
  }

  async syncCitationsFromContent(taskId: string): Promise<void> {
    const doc = await this.safeExportDocument(taskId);
    const sourceSections = doc?.sections ?? null;

    const indexToSections = new Map<number, Set<string>>();
    if (sourceSections) {
      for (const s of sourceSections) {
        const content = s.content ?? '';
        if (!content) continue;
        const cited = extractCitedIndices(content);
        for (const n of cited) {
          const set = indexToSections.get(n) ?? new Set<string>();
          set.add(s.id);
          indexToSections.set(n, set);
        }
      }
    } else {
      const sections = await this.prisma.writingSection.findMany({
        where: { session: { taskId } },
        select: { id: true, rawContent: true, editedContent: true },
      });

      for (const s of sections) {
        const content = s.editedContent ?? s.rawContent ?? '';
        if (!content) continue;
        const cited = extractCitedIndices(content);
        for (const n of cited) {
          const set = indexToSections.get(n) ?? new Set<string>();
          set.add(s.id);
          indexToSections.set(n, set);
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (sourceSections) {
        for (const s of sourceSections) {
          await tx.writingSection.update({
            where: { id: s.id },
            data: {
              rawContent: s.content,
            },
          });
        }
      }

      for (const [index, set] of indexToSections.entries()) {
        const citedInSections = Array.from(set);
        const citedCount = citedInSections.length;

        const existing = await tx.reference.findUnique({
          where: { taskId_index: { taskId, index } },
        });

        if (!existing) {
          await tx.reference.create({
            data: {
              taskId,
              index,
              type: RefType.WEB,
              title: `待补充文献 ${index}`,
              authors: '未知',
              year: null,
              source: RefSource.AI_GENERATED,
              verified: false,
              citedInSections,
              citedCount,
            },
          });
          continue;
        }

        await tx.reference.update({
          where: { id: existing.id },
          data: { citedInSections, citedCount },
        });
      }
    });
  }

  private async safeExportDocument(taskId: string): Promise<{
    sections: Array<{ id: string; content: string }>;
  } | null> {
    try {
      const doc = await this.writing.exportFullDocument({ taskId });
      return {
        sections: doc.sections.map((s) => ({ id: s.id, content: s.content })),
      };
    } catch {
      return null;
    }
  }

  async reorderByAppearance(taskId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.reorderByAppearanceTx(tx, taskId);
    });
  }

  async deleteAndCleanup(taskId: string, refId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const ref = await tx.reference.findUnique({ where: { id: refId } });
      if (!ref || ref.taskId !== taskId) {
        throw new NotFoundException(`文献不存在（id=${refId}）`);
      }

      await tx.reference.delete({ where: { id: ref.id } });

      const sections = await tx.writingSection.findMany({
        where: { session: { taskId } },
        select: { id: true, rawContent: true, editedContent: true },
      });

      for (const s of sections) {
        const nextRaw = s.rawContent
          ? removeCitation(s.rawContent, ref.index)
          : null;
        const nextEdited = s.editedContent
          ? removeCitation(s.editedContent, ref.index)
          : null;

        const rawChanged = (s.rawContent ?? null) !== nextRaw;
        const editedChanged = (s.editedContent ?? null) !== nextEdited;
        if (!rawChanged && !editedChanged) continue;

        await tx.writingSection.update({
          where: { id: s.id },
          data: {
            rawContent: rawChanged ? nextRaw : undefined,
            editedContent: editedChanged ? nextEdited : undefined,
          },
        });
      }

      await this.reorderByAppearanceTx(tx, taskId);
      await this.syncCitationsFromContentTx(tx, taskId);
    });
  }

  private async reorderByAppearanceTx(tx: Tx, taskId: string): Promise<void> {
    const sections = await tx.writingSection.findMany({
      where: { session: { taskId } },
      select: { id: true, rawContent: true, editedContent: true },
      orderBy: { orderIndex: 'asc' },
    });

    const appearance: number[] = [];
    const seen = new Set<number>();
    for (const s of sections) {
      const content = s.editedContent ?? s.rawContent ?? '';
      for (const n of extractCitedIndices(content)) {
        if (seen.has(n)) continue;
        seen.add(n);
        appearance.push(n);
      }
    }

    const refs = await tx.reference.findMany({
      where: { taskId },
      orderBy: { index: 'asc' },
    });
    if (refs.length === 0) return;

    const existingIndices = refs.map((r) => r.index);
    const remaining = existingIndices.filter((i) => !seen.has(i));
    const order = [...appearance, ...remaining];

    const mapping = new Map<number, number>();
    order.forEach((oldIndex, i) => mapping.set(oldIndex, i + 1));

    const OFFSET = 10000;
    for (const r of refs) {
      const next = mapping.get(r.index);
      if (!next) continue;
      await tx.reference.update({
        where: { id: r.id },
        data: { index: r.index + OFFSET },
      });
    }

    for (const r of refs) {
      const next = mapping.get(r.index);
      if (!next) continue;
      await tx.reference.update({
        where: { id: r.id },
        data: { index: next },
      });
    }

    for (const s of sections) {
      const currentRaw = s.rawContent ?? null;
      const currentEdited = s.editedContent ?? null;
      const nextRaw = currentRaw ? replaceCitations(currentRaw, mapping) : null;
      const nextEdited = currentEdited
        ? replaceCitations(currentEdited, mapping)
        : null;

      const rawChanged = currentRaw !== nextRaw;
      const editedChanged = currentEdited !== nextEdited;
      if (!rawChanged && !editedChanged) continue;

      await tx.writingSection.update({
        where: { id: s.id },
        data: {
          rawContent: rawChanged ? nextRaw : undefined,
          editedContent: editedChanged ? nextEdited : undefined,
        },
      });
    }
  }

  private async syncCitationsFromContentTx(
    tx: Tx,
    taskId: string,
  ): Promise<void> {
    const sections = await tx.writingSection.findMany({
      where: { session: { taskId } },
      select: { id: true, rawContent: true, editedContent: true },
    });

    const indexToSections = new Map<number, Set<string>>();
    for (const s of sections) {
      const content = s.editedContent ?? s.rawContent ?? '';
      if (!content) continue;
      const cited = extractCitedIndices(content);
      for (const n of cited) {
        const set = indexToSections.get(n) ?? new Set<string>();
        set.add(s.id);
        indexToSections.set(n, set);
      }
    }

    const refs = await tx.reference.findMany({
      where: { taskId },
      select: { id: true, index: true },
    });
    const byIndex = new Map<number, string>(refs.map((r) => [r.index, r.id]));

    for (const [index, set] of indexToSections.entries()) {
      const citedInSections = Array.from(set);
      const citedCount = citedInSections.length;

      const id = byIndex.get(index);
      if (!id) continue;
      await tx.reference.update({
        where: { id },
        data: { citedInSections, citedCount },
      });
    }
  }

  private uniqueByAppearance(items: number[]): number[] {
    const out: number[] = [];
    const seen = new Set<number>();
    for (const n of items) {
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out;
  }

  private async getNextIndex(taskId: string): Promise<number> {
    const max = await this.prisma.reference.aggregate({
      where: { taskId },
      _max: { index: true },
    });
    return (max._max.index ?? 0) + 1;
  }
}
