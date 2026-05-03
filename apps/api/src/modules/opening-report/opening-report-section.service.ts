import { Injectable, Logger } from '@nestjs/common';
import type { OpeningReportSection } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import {
  DEFAULT_SECTION_MAX_TOKENS,
  DEFAULT_SECTION_TEMPERATURE,
  OPENING_REPORT_TOTAL_SECTIONS,
  SECTION_PROGRESS_EMIT_INTERVAL_MS,
} from './constants/opening-report.constants';
import type { SectionConfig } from './interfaces/section-config.interface';
import type { GenerationContext } from './interfaces/generation-context.interface';
import type { SseEvent } from './interfaces/sse-event.interface';
import { countWords } from './utils/word-counter.util';

export type OpeningReportSectionRecord = OpeningReportSection;

@Injectable()
export class OpeningReportSectionService {
  private readonly logger = new Logger(OpeningReportSectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
  ) {}

  /**
   * 流式生成单个章节（AsyncGenerator）
   * 由父 Service 通过 yield* 委托调用
   * 返回值告知是否成功，失败信息保留在数据库
   */
  async *streamSection(
    section: OpeningReportSectionRecord,
    config: SectionConfig,
    context: GenerationContext,
    options: {
      taskId: string;
      temperature?: number;
      maxTokens?: number;
      model?: string;
      maxRetries?: number;
      timeout?: number;
    },
  ): AsyncGenerator<SseEvent, { success: boolean; error?: string }, unknown> {
    const sectionStartTime = Date.now();

    await this.prisma.openingReportSection.update({
      where: { id: section.id },
      data: { status: 'GENERATING', errorMessage: null },
    });

    const prompt = config.promptBuilder(context);
    let accumulated = '';
    let lastProgressEmit = Date.now();

    try {
      const stream = this.llmService.generateStream(prompt, {
        taskId: options.taskId,
        stage: 'OPENING',
        temperature: options.temperature ?? DEFAULT_SECTION_TEMPERATURE,
        maxTokens: options.maxTokens ?? DEFAULT_SECTION_MAX_TOKENS,
        model: options.model,
        maxRetries: options.maxRetries,
        timeout: options.timeout,
      });

      for await (const chunk of stream) {
        accumulated += chunk;
        yield {
          event: 'section_delta',
          data: { sectionKey: config.key, delta: chunk },
        };

        if (Date.now() - lastProgressEmit > SECTION_PROGRESS_EMIT_INTERVAL_MS) {
          const sectionPercent = Math.min(
            100,
            Math.round(
              (countWords(accumulated) / config.expectedWordCount.max) * 100,
            ),
          );

          yield {
            event: 'progress',
            data: {
              overallPercent: 0,
              currentSection: config.key,
              sectionPercent,
              completedSections: 0,
              totalSections: OPENING_REPORT_TOTAL_SECTIONS,
            },
          };

          lastProgressEmit = Date.now();
        }
      }

      const wordCount = countWords(accumulated);
      if (wordCount < config.expectedWordCount.min * 0.6) {
        throw new Error(
          `字数过少: ${wordCount} < ${Math.round(config.expectedWordCount.min * 0.6)}`,
        );
      }

      await this.prisma.openingReportSection.update({
        where: { id: section.id },
        data: {
          status: 'COMPLETED',
          content: accumulated,
          wordCount,
          durationMs: Date.now() - sectionStartTime,
          generatedAt: new Date(),
          errorMessage: null,
        },
      });

      yield {
        event: 'section_end',
        data: {
          sectionKey: config.key,
          sectionIndex: config.index,
          content: accumulated,
          wordCount,
        },
      };

      return { success: true };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.openingReportSection.update({
        where: { id: section.id },
        data: {
          status: 'FAILED',
          errorMessage: errMsg,
          retryCount: { increment: 1 },
          content: accumulated || null,
          wordCount: countWords(accumulated),
          durationMs: Date.now() - sectionStartTime,
        },
      });

      this.logger.error(`章节生成失败 sectionKey=${config.key}`, error);
      return { success: false, error: errMsg };
    }
  }
}
