import { BadRequestException, Injectable } from '@nestjs/common';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { WritingSessionNotFoundException } from '../exceptions/writing-session-not-found.exception';
import type { RetrySectionDto } from '../dto/retry-section.dto';
import type { StartWritingDto } from '../dto/start-writing.dto';
import type { WritingSseEvent } from '../interfaces/sse-event.interface';
import type {
  FullDocumentDto,
  FullDocumentSectionDto,
} from '../dto/writing-response.dto';
import type { UpdateSectionDto } from '../dto/update-section.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { TaskService } from '../../task/task.service';
import { ReferenceResolverService } from './reference-resolver.service';
import { WritingOrchestratorService } from './writing-orchestrator.service';
import { WritingSectionService } from './writing-section.service';
import { WritingSessionService } from './writing-session.service';
import { formatGBT7714 } from '../../reference/formatters/gbt7714.formatter';

function sanitizeFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function toParagraphsWithSuperscriptCitations(text: string): Paragraph[] {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.trim()) {
    return [new Paragraph({ children: [new TextRun('')] })];
  }

  const lines = normalized.split('\n');
  return lines.map((line) => {
    if (!line.trim().length) {
      return new Paragraph({ children: [new TextRun('')] });
    }

    const children: TextRun[] = [];
    const re = /\[(\d{1,3})\]/g;
    let lastIndex = 0;
    for (const match of line.matchAll(re)) {
      const mIndex = match.index ?? 0;
      const before = line.slice(lastIndex, mIndex);
      if (before) children.push(new TextRun(before));

      const n = match[1] ?? '';
      children.push(new TextRun({ text: `[${n}]`, superScript: true }));
      lastIndex = mIndex + match[0].length;
    }
    const rest = line.slice(lastIndex);
    if (rest) children.push(new TextRun(rest));

    return new Paragraph({ children });
  });
}

@Injectable()
export class WritingService {
  constructor(
    private readonly orchestrator: WritingOrchestratorService,
    private readonly sessionService: WritingSessionService,
    private readonly sectionService: WritingSectionService,
    private readonly referenceResolver: ReferenceResolverService,
    private readonly taskService: TaskService,
    private readonly prisma: PrismaService,
  ) {}

  generateStream(
    taskId: string,
    dto: StartWritingDto,
  ): AsyncIterable<WritingSseEvent> {
    return this.orchestrator.startWriting(taskId, dto);
  }

  resumeStream(
    taskId: string,
    sessionId: string,
    dto: StartWritingDto,
    fromOrderIndex?: number,
  ): AsyncIterable<WritingSseEvent> {
    return this.orchestrator.resumeWriting(
      taskId,
      sessionId,
      dto,
      fromOrderIndex,
    );
  }

  regenerateFromStream(
    taskId: string,
    sessionId: string,
    dto: StartWritingDto,
    fromOrderIndex: number,
  ): AsyncIterable<WritingSseEvent> {
    return this.orchestrator.regenerateFrom(
      taskId,
      sessionId,
      dto,
      fromOrderIndex,
    );
  }

  retrySectionStream(
    taskId: string,
    sessionId: string,
    sectionId: string,
    dto: RetrySectionDto,
  ): AsyncIterable<WritingSseEvent> {
    return this.orchestrator.retrySection(taskId, sessionId, sectionId, dto);
  }

  async listSessions(taskId: string) {
    return this.sessionService.listByTaskId(taskId);
  }

  async getLatestSession(taskId: string) {
    return this.sessionService.findLatestByTaskId(taskId);
  }

  async listSections(sessionId: string) {
    return this.sectionService.listBySessionId(sessionId);
  }

  async updateSection(sectionId: string, dto: UpdateSectionDto) {
    return this.sectionService.updateEditedContent({
      sectionId,
      content: dto.content,
    });
  }

  async exportFullDocument(params: {
    taskId: string;
    sessionId?: string;
  }): Promise<FullDocumentDto> {
    const session = params.sessionId
      ? await this.sessionService.findById(params.sessionId)
      : await this.sessionService.findLatestByTaskId(params.taskId);

    if (!session) throw new WritingSessionNotFoundException(params.taskId);
    if (session.taskId !== params.taskId) {
      throw new BadRequestException('sessionId 不属于该 taskId');
    }

    const sections = await this.sectionService.listBySessionId(session.id);
    if (sections.length === 0) {
      throw new BadRequestException('写作小节为空');
    }

    const sectionContents = sections.map((s) => {
      const content = this.sectionService.getEffectiveContent(s) ?? '';
      return { id: s.id, content };
    });

    const resolved = this.referenceResolver.resolveAll(sectionContents);
    const resolvedMap = new Map(
      resolved.resolvedSections.map((s) => [s.id, s.resolvedContent]),
    );

    const sectionDtos: FullDocumentSectionDto[] = sections.map((s) => ({
      id: s.id,
      orderIndex: s.orderIndex,
      title: s.title,
      content: resolvedMap.get(s.id) ?? '',
      wordCount: s.wordCount ?? 0,
    }));

    const totalWords = sectionDtos.reduce(
      (acc, s) => acc + (s.wordCount ?? 0),
      0,
    );

    return {
      taskId: params.taskId,
      sessionId: session.id,
      totalWords,
      sections: sectionDtos,
      references: resolved.references,
    };
  }

  async exportDocx(params: {
    taskId: string;
    sessionId?: string;
  }): Promise<{ fileName: string; buffer: Buffer }> {
    const task = await this.taskService.findById(params.taskId);
    const doc = await this.exportFullDocument(params);

    const title = (task.title ?? '').trim() || '论文正文';
    const paragraphs: Paragraph[] = [];
    paragraphs.push(
      new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
    );

    const ordered = doc.sections
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex);
    for (const s of ordered) {
      paragraphs.push(
        new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_1 }),
      );
      paragraphs.push(...toParagraphsWithSuperscriptCitations(s.content ?? ''));
      paragraphs.push(new Paragraph({ children: [new TextRun('')] }));
    }

    const refs = await this.prisma.reference.findMany({
      where: { taskId: params.taskId },
      orderBy: { index: 'asc' },
    });
    if (refs.length) {
      paragraphs.push(
        new Paragraph({ text: '参考文献', heading: HeadingLevel.HEADING_1 }),
      );
      for (const r of refs) {
        paragraphs.push(
          new Paragraph({ children: [new TextRun(formatGBT7714(r))] }),
        );
      }
    }

    const docx = new Document({
      creator: 'PaperGen',
      title,
      sections: [{ children: paragraphs }],
    });

    const buffer = await Packer.toBuffer(docx);
    const fileName = `${sanitizeFileName(title)}-正文.docx`;
    return { fileName, buffer };
  }

  requestCancel(sessionId: string): void {
    this.orchestrator.requestCancel(sessionId);
  }
}
