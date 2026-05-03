import { BadRequestException, Injectable } from '@nestjs/common';
import { WritingSessionNotFoundException } from '../exceptions/writing-session-not-found.exception';
import type { RetrySectionDto } from '../dto/retry-section.dto';
import type { StartWritingDto } from '../dto/start-writing.dto';
import type { WritingSseEvent } from '../interfaces/sse-event.interface';
import type {
  FullDocumentDto,
  FullDocumentSectionDto,
} from '../dto/writing-response.dto';
import type { UpdateSectionDto } from '../dto/update-section.dto';
import { ReferenceResolverService } from './reference-resolver.service';
import { WritingOrchestratorService } from './writing-orchestrator.service';
import { WritingSectionService } from './writing-section.service';
import { WritingSessionService } from './writing-session.service';

@Injectable()
export class WritingService {
  constructor(
    private readonly orchestrator: WritingOrchestratorService,
    private readonly sessionService: WritingSessionService,
    private readonly sectionService: WritingSectionService,
    private readonly referenceResolver: ReferenceResolverService,
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

  requestCancel(sessionId: string): void {
    this.orchestrator.requestCancel(sessionId);
  }
}
