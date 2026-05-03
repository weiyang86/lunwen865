import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { OpeningReport } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskService } from '../task/task.service';
import { GenerationStage } from '../task/constants/generation-stage.enum';
import {
  GENERATION_CONCURRENCY_WINDOW_MS,
  OPENING_REPORT_TOTAL_SECTIONS,
} from './constants/opening-report.constants';
import { OPENING_REPORT_SECTIONS } from './constants/section-config.constants';
import type { StartGenerationDto } from './dto/start-generation.dto';
import type { ResumeGenerationDto } from './dto/resume-generation.dto';
import type { RetrySectionDto } from './dto/retry-section.dto';
import type {
  GenerationContext,
  PreviousSection,
} from './interfaces/generation-context.interface';
import type { SseEvent } from './interfaces/sse-event.interface';
import { InvalidReportStateException } from './exceptions/invalid-report-state.exception';
import { OpeningReportSectionService } from './opening-report-section.service';
import type { OpeningReportSectionRecord } from './opening-report-section.service';
import { buildSummary } from './utils/stream-aggregator.util';
import { countWords } from './utils/word-counter.util';

const OPENING_REPORT_VERSION = 1;

export type OpeningReportRecord = OpeningReport;

@Injectable()
export class OpeningReportService {
  private readonly logger = new Logger(OpeningReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
    private readonly sectionService: OpeningReportSectionService,
  ) {}

  /**
   * 创建报告记录
   */
  async createReport(taskId: string): Promise<OpeningReportRecord> {
    await this.taskService.findById(taskId);

    const existing = await this.prisma.openingReport.findUnique({
      where: {
        taskId_version: { taskId, version: OPENING_REPORT_VERSION },
      },
    });

    if (existing) return existing;

    return this.prisma.openingReport.create({
      data: {
        taskId,
        version: OPENING_REPORT_VERSION,
        content: {},
        status: 'PENDING',
        totalWordCount: 0,
        retryCount: 0,
      },
    });
  }

  /**
   * 同步生成（调试用）
   */
  async generateSync(
    taskId: string,
    dto?: StartGenerationDto,
  ): Promise<OpeningReportRecord> {
    for await (const _ of this.generateStream(taskId, dto)) {
      void _;
    }

    const report = await this.prisma.openingReport.findUnique({
      where: {
        taskId_version: { taskId, version: OPENING_REPORT_VERSION },
      },
    });

    if (!report) {
      throw new InvalidReportStateException('开题报告不存在');
    }
    return report;
  }

  /**
   * 流式生成（核心）：返回 AsyncGenerator，由 Controller 转换为 SSE
   */
  async *generateStream(
    taskId: string,
    dto?: StartGenerationDto,
  ): AsyncGenerator<SseEvent, void, unknown> {
    const startTime = Date.now();

    const task = await this.taskService.findById(taskId);
    this.assertCanGenerate(task);

    const report = await this.getOrCreateReport(taskId);
    this.assertNoConcurrentGenerating(report);

    await this.ensureAllSectionsExist(report.id);

    await this.prisma.openingReport.update({
      where: { id: report.id },
      data: {
        status: 'GENERATING',
        generationStartedAt: new Date(),
        errorMessage: null,
      },
    });

    yield {
      event: 'start',
      data: {
        reportId: report.id,
        totalSections: OPENING_REPORT_TOTAL_SECTIONS,
        sections: OPENING_REPORT_SECTIONS.map((s) => ({
          key: s.key,
          title: s.title,
          index: s.index,
        })),
      },
    };

    const failedSections: string[] = [];
    let completedSections = 0;

    for (const config of OPENING_REPORT_SECTIONS) {
      const section = await this.getSection(report.id, config.key);

      if (section.status === 'COMPLETED') {
        completedSections += 1;
        yield {
          event: 'section_end',
          data: {
            sectionKey: config.key,
            sectionIndex: config.index,
            content: section.content ?? '',
            wordCount: section.wordCount ?? 0,
            skipped: true,
          },
        };
        continue;
      }

      yield {
        event: 'section_start',
        data: {
          sectionKey: config.key,
          sectionIndex: config.index,
          sectionTitle: config.title,
        },
      };

      const context = await this.buildContextForSection(
        task,
        report.id,
        config.key,
        dto?.additionalRequirements,
      );

      const result = yield* this.sectionService.streamSection(
        section,
        config,
        context,
        {
          taskId,
          temperature: dto?.temperature,
          maxTokens: dto?.maxTokens,
          model: dto?.model,
          maxRetries: dto?.maxRetries,
          timeout: dto?.timeout,
        },
      );

      if (!result.success) {
        failedSections.push(config.key);
        yield {
          event: 'error',
          data: {
            sectionKey: config.key,
            code: 'SECTION_FAILED',
            message: result.error ?? 'Unknown error',
            recoverable: true,
          },
        };
        continue;
      }

      completedSections += 1;

      yield {
        event: 'progress',
        data: {
          overallPercent: Math.round(
            ((config.index + 1) / OPENING_REPORT_TOTAL_SECTIONS) * 100,
          ),
          currentSection: config.key,
          sectionPercent: 100,
          completedSections,
          totalSections: OPENING_REPORT_TOTAL_SECTIONS,
        },
      };
    }

    if (failedSections.length > 0) {
      await (
        this.prisma as unknown as {
          openingReport: {
            update: (args: {
              where: { id: string };
              data: Record<string, unknown>;
            }) => Promise<unknown>;
          };
        }
      ).openingReport.update({
        where: { id: report.id },
        data: {
          status: 'PARTIAL',
          errorMessage: `失败章节: ${failedSections.join(',')}`,
        },
      });

      yield {
        event: 'error',
        data: {
          code: 'PARTIAL_COMPLETION',
          message: `开题报告部分完成，失败章节: ${failedSections.join(',')}`,
          recoverable: true,
          failedSections,
        },
      };
      return;
    }

    const { content, wordCount } = await this.assembleFullContent(report.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.openingReport.update({
        where: { id: report.id },
        data: {
          status: 'COMPLETED',
          fullContent: content,
          totalWordCount: wordCount,
          generationEndedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      });
    });

    await this.taskService.onStageCompleted(taskId, GenerationStage.OPENING);

    yield {
      event: 'done',
      data: {
        reportId: report.id,
        totalWordCount: wordCount,
        durationMs: Date.now() - startTime,
      },
    };

    this.logger.log(`开题报告生成完成 taskId=${taskId} reportId=${report.id}`);
  }

  /**
   * 续传
   */
  async *resumeStream(
    taskId: string,
    dto?: ResumeGenerationDto,
  ): AsyncGenerator<SseEvent, void, unknown> {
    const report = await this.getOrCreateReport(taskId);
    const startDto: StartGenerationDto = {
      additionalRequirements: dto?.additionalRequirements,
      temperature: dto?.temperature,
      maxTokens: dto?.maxTokens,
      model: dto?.model,
      maxRetries: dto?.maxRetries,
      timeout: dto?.timeout,
    };

    const fromKey = dto?.fromSectionKey;
    const fromIndex = fromKey
      ? (OPENING_REPORT_SECTIONS.find((s) => s.key === fromKey)?.index ?? 0)
      : 0;

    const task = await this.taskService.findById(taskId);
    this.assertCanGenerate(task);
    this.assertNoConcurrentGenerating(report);
    await this.ensureAllSectionsExist(report.id);

    yield {
      event: 'start',
      data: {
        reportId: report.id,
        totalSections: OPENING_REPORT_TOTAL_SECTIONS,
        sections: OPENING_REPORT_SECTIONS.map((s) => ({
          key: s.key,
          title: s.title,
          index: s.index,
        })),
      },
    };

    const failedSections: string[] = [];
    let completedSections = 0;

    for (const config of OPENING_REPORT_SECTIONS) {
      const section = await this.getSection(report.id, config.key);

      if (config.index < fromIndex) {
        yield {
          event: 'section_end',
          data: {
            sectionKey: config.key,
            sectionIndex: config.index,
            content: section.content ?? '',
            wordCount: section.wordCount ?? 0,
            skipped: true,
          },
        };
        if (section.status === 'COMPLETED') completedSections += 1;
        continue;
      }

      if (section.status === 'COMPLETED') {
        completedSections += 1;
        yield {
          event: 'section_end',
          data: {
            sectionKey: config.key,
            sectionIndex: config.index,
            content: section.content ?? '',
            wordCount: section.wordCount ?? 0,
            skipped: true,
          },
        };
        continue;
      }

      yield {
        event: 'section_start',
        data: {
          sectionKey: config.key,
          sectionIndex: config.index,
          sectionTitle: config.title,
        },
      };

      const context = await this.buildContextForSection(
        task,
        report.id,
        config.key,
        startDto.additionalRequirements,
      );

      const result = yield* this.sectionService.streamSection(
        section,
        config,
        context,
        {
          taskId,
          temperature: startDto.temperature,
          maxTokens: startDto.maxTokens,
          model: startDto.model,
          maxRetries: startDto.maxRetries,
          timeout: startDto.timeout,
        },
      );

      if (!result.success) {
        failedSections.push(config.key);
        yield {
          event: 'error',
          data: {
            sectionKey: config.key,
            code: 'SECTION_FAILED',
            message: result.error ?? 'Unknown error',
            recoverable: true,
          },
        };
        continue;
      }

      completedSections += 1;

      yield {
        event: 'progress',
        data: {
          overallPercent: Math.round(
            ((config.index + 1) / OPENING_REPORT_TOTAL_SECTIONS) * 100,
          ),
          currentSection: config.key,
          sectionPercent: 100,
          completedSections,
          totalSections: OPENING_REPORT_TOTAL_SECTIONS,
        },
      };
    }

    if (failedSections.length > 0) {
      await this.prisma.openingReport.update({
        where: { id: report.id },
        data: {
          status: 'PARTIAL',
          errorMessage: `失败章节: ${failedSections.join(',')}`,
        },
      });

      yield {
        event: 'error',
        data: {
          code: 'PARTIAL_COMPLETION',
          message: `开题报告部分完成，失败章节: ${failedSections.join(',')}`,
          recoverable: true,
          failedSections,
        },
      };
      return;
    }

    const { content, wordCount } = await this.assembleFullContent(report.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.openingReport.update({
        where: { id: report.id },
        data: {
          status: 'COMPLETED',
          fullContent: content,
          totalWordCount: wordCount,
          generationEndedAt: new Date(),
        },
      });
    });

    await this.taskService.onStageCompleted(taskId, GenerationStage.OPENING);

    yield {
      event: 'done',
      data: {
        reportId: report.id,
        totalWordCount: wordCount,
        durationMs: 0,
      },
    };
  }

  /**
   * 重试单章节
   */
  async *retrySection(
    taskId: string,
    sectionKey: string,
    dto?: RetrySectionDto,
  ): AsyncGenerator<SseEvent, void, unknown> {
    const task = await this.taskService.findById(taskId);
    this.assertCanGenerate(task);

    const report = await this.getOrCreateReport(taskId);
    await this.ensureAllSectionsExist(report.id);

    const config = OPENING_REPORT_SECTIONS.find((s) => s.key === sectionKey);
    if (!config) {
      throw new InvalidReportStateException(`未知章节: ${sectionKey}`);
    }

    const section = await this.getSection(report.id, sectionKey);

    await this.prisma.openingReportSection.update({
      where: { id: section.id },
      data: {
        status: 'PENDING',
        content: null,
        wordCount: 0,
        errorMessage: null,
      },
    });

    yield {
      event: 'section_start',
      data: {
        sectionKey,
        sectionIndex: config.index,
        sectionTitle: config.title,
      },
    };

    const refreshed = await this.getSection(report.id, sectionKey);
    const additionalRequirements =
      [dto?.feedback, dto?.additionalRequirements].filter(
        (v): v is string => typeof v === 'string' && v.trim().length > 0,
      ).length > 0
        ? [dto?.feedback, dto?.additionalRequirements]
            .filter(
              (v): v is string => typeof v === 'string' && v.trim().length > 0,
            )
            .join('\n')
        : undefined;
    const context = await this.buildContextForSection(
      task,
      report.id,
      sectionKey,
      additionalRequirements,
    );

    const result = yield* this.sectionService.streamSection(
      refreshed,
      config,
      context,
      {
        taskId,
        temperature: dto?.temperature,
        maxTokens: dto?.maxTokens,
        model: dto?.model,
        maxRetries: dto?.maxRetries,
        timeout: dto?.timeout,
      },
    );

    if (!result.success) {
      yield {
        event: 'error',
        data: {
          sectionKey,
          code: 'SECTION_FAILED',
          message: result.error ?? 'Unknown error',
          recoverable: true,
        },
      };
      return;
    }

    const { content, wordCount } = await this.assembleFullContent(report.id);

    await this.prisma.openingReport.update({
      where: { id: report.id },
      data: {
        fullContent: content,
        totalWordCount: wordCount,
      },
    });

    yield {
      event: 'done',
      data: { reportId: report.id, totalWordCount: wordCount, durationMs: 0 },
    };
  }

  async findByTaskId(
    taskId: string,
  ): Promise<OpeningReportRecord & { sections: OpeningReportSectionRecord[] }> {
    const report = await this.prisma.openingReport.findUnique({
      where: {
        taskId_version: { taskId, version: OPENING_REPORT_VERSION },
      },
    });

    if (!report) {
      throw new InvalidReportStateException('开题报告不存在');
    }

    const sections = await this.prisma.openingReportSection.findMany({
      where: { reportId: report.id },
      orderBy: { sectionIndex: 'asc' },
    });

    return { ...report, sections };
  }

  async findSection(
    taskId: string,
    sectionKey: string,
  ): Promise<OpeningReportSectionRecord> {
    const report = await this.getOrCreateReport(taskId);
    await this.ensureAllSectionsExist(report.id);

    return this.getSection(report.id, sectionKey);
  }

  async deleteReport(taskId: string): Promise<void> {
    const report = await this.prisma.openingReport.findUnique({
      where: {
        taskId_version: { taskId, version: OPENING_REPORT_VERSION },
      },
    });

    if (!report) {
      throw new InvalidReportStateException('开题报告不存在');
    }

    await this.prisma.openingReport.delete({ where: { id: report.id } });
  }

  private assertCanGenerate(task: {
    currentStage: unknown;
    title: string | null;
  }): void {
    if (!task.title || task.title.trim().length === 0) {
      throw new InvalidReportStateException(
        '任务 title 为空，无法生成开题报告',
      );
    }
    if (task.currentStage !== 'OPENING') {
      throw new InvalidReportStateException(
        `任务阶段不允许生成开题报告: ${String(task.currentStage)}`,
      );
    }
  }

  private async getOrCreateReport(
    taskId: string,
  ): Promise<OpeningReportRecord> {
    const existing = await this.prisma.openingReport.findUnique({
      where: {
        taskId_version: { taskId, version: OPENING_REPORT_VERSION },
      },
    });

    if (existing) return existing;

    return this.prisma.openingReport.create({
      data: {
        taskId,
        version: OPENING_REPORT_VERSION,
        content: {},
        status: 'PENDING',
        totalWordCount: 0,
        retryCount: 0,
      },
    });
  }

  private assertNoConcurrentGenerating(report: OpeningReportRecord): void {
    if (report.status !== 'GENERATING' || !report.generationStartedAt) return;
    const age = Date.now() - report.generationStartedAt.getTime();
    if (age < GENERATION_CONCURRENCY_WINDOW_MS) {
      throw new ConflictException('该任务正在生成中，请稍后再试');
    }
  }

  private async ensureAllSectionsExist(reportId: string): Promise<void> {
    const existing = await this.prisma.openingReportSection.findMany({
      where: { reportId },
      select: { sectionKey: true },
    });

    const existedKeys = new Set(existing.map((s) => s.sectionKey));
    const missing = OPENING_REPORT_SECTIONS.filter(
      (s) => !existedKeys.has(s.key),
    );
    if (missing.length === 0) return;

    await this.prisma.$transaction(
      missing.map((s) => {
        return this.prisma.openingReportSection.create({
          data: {
            reportId,
            sectionKey: s.key,
            sectionTitle: s.title,
            sectionIndex: s.index,
            status: 'PENDING',
            wordCount: 0,
            retryCount: 0,
          },
        });
      }),
    );
  }

  private async getSection(
    reportId: string,
    sectionKey: string,
  ): Promise<OpeningReportSectionRecord> {
    const section = await this.prisma.openingReportSection.findUnique({
      where: {
        reportId_sectionKey: { reportId, sectionKey },
      },
    });

    if (!section) {
      throw new InvalidReportStateException(`章节不存在: ${sectionKey}`);
    }
    return section;
  }

  private async buildContextForSection(
    task: {
      id: string;
      title: string | null;
      requirements: string | null;
      educationLevel: string;
    },
    reportId: string,
    currentSectionKey: string,
    additionalRequirements?: string,
  ): Promise<GenerationContext> {
    const extracted = this.extractTopicKeywordsLanguage(task.requirements);
    const academicLevel = this.toAcademicLevel(task.educationLevel);

    const completedSections = await this.prisma.openingReportSection.findMany({
      where: { reportId, status: 'COMPLETED' },
      orderBy: { sectionIndex: 'asc' },
      select: {
        sectionKey: true,
        sectionTitle: true,
        content: true,
      },
    });

    const previousSections: PreviousSection[] = completedSections
      .filter((s) => s.sectionKey !== currentSectionKey)
      .map((s) => ({
        key: s.sectionKey,
        title: s.sectionTitle,
        summary: buildSummary(s.content ?? '', 200),
      }));

    return {
      topic: extracted.topic,
      title: task.title ?? '',
      keywords: extracted.keywords,
      academicLevel,
      language: extracted.language,
      previousSections,
      additionalRequirements,
    };
  }

  private toAcademicLevel(
    educationLevel: string,
  ): 'UNDERGRADUATE' | 'MASTER' | 'DOCTOR' {
    if (educationLevel.includes('博士')) return 'DOCTOR';
    if (educationLevel.includes('硕士') || educationLevel.includes('研究生'))
      return 'MASTER';
    return 'UNDERGRADUATE';
  }

  private extractTopicKeywordsLanguage(requirements: string | null): {
    topic: string;
    keywords: string[];
    language: string;
  } {
    const fallback = {
      topic: (requirements ?? '').trim(),
      keywords: [],
      language: 'zh-CN',
    };

    if (!requirements) return fallback;

    try {
      const parsed = JSON.parse(requirements) as unknown;
      if (!parsed || typeof parsed !== 'object') return fallback;
      const obj = parsed as {
        topic?: unknown;
        keywords?: unknown;
        language?: unknown;
      };
      if (typeof obj.topic !== 'string') return fallback;

      const keywords =
        Array.isArray(obj.keywords) &&
        obj.keywords.every((k) => typeof k === 'string')
          ? obj.keywords
          : [];

      const language =
        typeof obj.language === 'string' ? obj.language : 'zh-CN';

      return { topic: obj.topic.trim(), keywords, language };
    } catch {
      return fallback;
    }
  }

  private async assembleFullContent(
    reportId: string,
  ): Promise<{ content: string; wordCount: number }> {
    const sections = await this.prisma.openingReportSection.findMany({
      where: { reportId },
      orderBy: { sectionIndex: 'asc' },
      select: { content: true },
    });

    const content = sections
      .map((s) => (s.content ?? '').trim())
      .filter((s) => s.length > 0)
      .join('\n\n');

    return { content, wordCount: countWords(content) };
  }
}
