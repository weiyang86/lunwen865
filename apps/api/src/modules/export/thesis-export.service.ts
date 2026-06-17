import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ThesisExportFormat,
  ThesisExportJobStatus,
  ThesisFormatTemplateStatus,
} from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskService } from '../task/task.service';
import { sanitizeFilename } from './utils/filename.util';
import { ThesisDocxExportService } from './thesis-docx-export.service';
import { ThesisExportTemplateService } from './thesis-export-template.service';
import type {
  CreateThesisExportJobDto,
  ExportOptionsQueryDto,
  ListThesisExportJobsDto,
} from './dto/thesis-format-template.dto';

type Actor = { id: string; role?: string; admin?: boolean };
type SectionNode = Prisma.ThesisDocumentSectionGetPayload<object> & {
  children?: SectionNode[];
};

const EXPORT_STAGES = [
  'TOPIC',
  'PROPOSAL',
  'OUTLINE',
  'FULL_PAPER',
  'REFERENCE',
  'FINAL',
];

@Injectable()
export class ThesisExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
    private readonly templateService: ThesisExportTemplateService,
    private readonly docx: ThesisDocxExportService,
  ) {}

  async getExportOptions(
    taskId: string,
    query: ExportOptionsQueryDto,
    actor: Actor,
  ) {
    await this.assertTaskAccess(taskId, actor);
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        academicSchool: { select: { id: true, name: true } },
        college: { select: { id: true, name: true } },
        academicMajor: { select: { id: true, name: true } },
        thesisDocument: {
          select: {
            id: true,
            title: true,
            status: true,
            wordCount: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!task) throw new NotFoundException('任务不存在');
    const templates = await this.templateService.resolveExportTemplatesForTask(
      taskId,
      { stage: query.stage, exportFormat: query.exportFormat },
    );
    const warnings: string[] = [];
    if (!task.thesisDocument)
      warnings.push('请先在论文文档工作台初始化并完善论文内容');
    if (!templates.length)
      warnings.push('未找到可用格式模板，请联系管理员创建全局通用模板');
    return {
      canExport: Boolean(task.thesisDocument && templates.length),
      task: {
        id: task.id,
        title: task.title,
        schoolName: task.academicSchool?.name ?? null,
        collegeName: task.college?.name ?? null,
        majorName: task.academicMajor?.name ?? task.major,
        educationLevel: task.educationLevel,
        thesisType: task.thesisType,
      },
      document: task.thesisDocument,
      availableStages: EXPORT_STAGES,
      availableFormats: [ThesisExportFormat.DOCX, ThesisExportFormat.PDF],
      matchedTemplates: templates,
      defaultTemplate: templates[0] ?? null,
      warningMessages: warnings,
    };
  }

  async createJob(taskId: string, dto: CreateThesisExportJobDto, actor: Actor) {
    await this.assertTaskAccess(taskId, actor);
    if (dto.exportFormat === ThesisExportFormat.PDF) {
      throw new BadRequestException(
        'PDF 导出将在后续版本开放，请先使用 Word 导出。',
      );
    }
    const document = await this.prisma.thesisDocument.findUnique({
      where: { id: dto.documentId },
    });
    if (!document || document.taskId !== taskId)
      throw new BadRequestException('论文文档不存在或不属于当前任务');
    const template = await this.prisma.thesisFormatTemplate.findFirst({
      where: { id: dto.templateId, status: ThesisFormatTemplateStatus.ENABLED },
    });
    if (!template) throw new BadRequestException('格式模板不存在或已禁用');
    const job = await this.prisma.thesisExportJob.create({
      data: {
        taskId,
        documentId: dto.documentId,
        templateId: dto.templateId,
        userId: actor.id,
        exportStage: dto.exportStage,
        exportFormat: dto.exportFormat,
        customRequirement: dto.customRequirement,
        status: ThesisExportJobStatus.PENDING,
        progress: 0,
      },
    });
    void this.processJob(job.id);
    return this.getJob(job.id, actor);
  }

  async getJob(jobId: string, actor: Actor) {
    const job = await this.prisma.thesisExportJob.findUnique({
      where: { id: jobId },
      include: { template: true, files: true },
    });
    if (!job) throw new NotFoundException('导出任务不存在');
    if (!actor.admin && job.userId !== actor.id)
      throw new ForbiddenException('无权访问该导出任务');
    return { ...job, hasFile: Boolean(job.fileUrl) };
  }

  async listTaskJobs(taskId: string, actor: Actor) {
    await this.assertTaskAccess(taskId, actor);
    const items = await this.prisma.thesisExportJob.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { id: true, name: true, code: true } },
        files: true,
      },
      take: 50,
    });
    return { items };
  }

  async listAdminJobs(q: ListThesisExportJobsDto) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 20));
    const where: Prisma.ThesisExportJobWhereInput = {};
    if (q.taskId) where.taskId = q.taskId;
    if (q.userId) where.userId = q.userId;
    if (q.status) where.status = q.status;
    if (q.exportStage) where.exportStage = q.exportStage;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.thesisExportJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          template: { select: { id: true, name: true, code: true } },
          task: { select: { id: true, title: true } },
          user: {
            select: { id: true, nickname: true, email: true, phone: true },
          },
          files: true,
        },
      }),
      this.prisma.thesisExportJob.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getAdminJob(id: string) {
    const job = await this.prisma.thesisExportJob.findUnique({
      where: { id },
      include: {
        template: { include: { rules: true } },
        task: true,
        user: true,
        document: true,
        files: true,
      },
    });
    if (!job) throw new NotFoundException('导出任务不存在');
    return job;
  }

  async retryAdminJob(id: string) {
    const job = await this.prisma.thesisExportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('导出任务不存在');
    if (job.status !== ThesisExportJobStatus.FAILED)
      throw new BadRequestException('仅失败任务可重试');
    await this.prisma.thesisExportJob.update({
      where: { id },
      data: {
        status: ThesisExportJobStatus.PENDING,
        progress: 0,
        errorMessage: null,
        fileUrl: null,
        fileName: null,
        fileSize: null,
        startedAt: null,
        finishedAt: null,
      },
    });
    await this.prisma.thesisExportFile.deleteMany({
      where: { exportJobId: id },
    });
    void this.processJob(id);
    return this.getAdminJob(id);
  }

  async getDownloadInfo(jobId: string, actor: Actor) {
    const job = await this.prisma.thesisExportJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException('导出任务不存在');
    if (!actor.admin && job.userId !== actor.id)
      throw new ForbiddenException('无权下载该文件');
    if (
      job.status !== ThesisExportJobStatus.SUCCESS ||
      !job.fileUrl ||
      !job.fileName
    )
      throw new BadRequestException('导出文件尚未生成');
    const filePath = path.join(
      process.cwd(),
      'uploads',
      'thesis-exports',
      job.userId,
      `${job.id}.docx`,
    );
    try {
      await fs.promises.stat(filePath);
    } catch {
      throw new BadRequestException('文件已丢失，请重新导出');
    }
    return { filePath, fileName: job.fileName };
  }

  async processJob(jobId: string) {
    let filePath: string | null = null;
    try {
      const job = await this.prisma.thesisExportJob.update({
        where: { id: jobId },
        data: {
          status: ThesisExportJobStatus.RUNNING,
          progress: 10,
          startedAt: new Date(),
          errorMessage: null,
        },
        include: { document: true, template: { include: { rules: true } } },
      });
      const sections = await this.prisma.thesisDocumentSection.findMany({
        where: { documentId: job.documentId, deletedAt: null },
        orderBy: [
          { parentId: 'asc' },
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      });
      const tree = this.buildTree(sections);
      await this.prisma.thesisExportJob.update({
        where: { id: jobId },
        data: { progress: 35 },
      });
      const buffer = await this.docx.build({
        title: job.document.title,
        abstract: job.document.abstract,
        keywords: job.document.keywords,
        sections: tree,
        rules: job.template.rules,
      });
      await this.prisma.thesisExportJob.update({
        where: { id: jobId },
        data: { progress: 75 },
      });
      const dir = path.join(
        process.cwd(),
        'uploads',
        'thesis-exports',
        job.userId,
      );
      await fs.promises.mkdir(dir, { recursive: true });
      const fileName = sanitizeFilename(
        `${job.document.title || job.id}-${job.exportStage}.docx`,
      );
      filePath = path.join(dir, `${job.id}.docx`);
      await fs.promises.writeFile(filePath, buffer);
      const fileUrl = `/api/thesis-export-jobs/${job.id}/download`;
      await this.prisma.thesisExportFile.create({
        data: {
          exportJobId: job.id,
          fileName,
          fileUrl,
          fileType: ThesisExportFormat.DOCX,
          fileSize: buffer.length,
          storageProvider: 'local',
        },
      });
      await this.prisma.thesisExportJob.update({
        where: { id: job.id },
        data: {
          status: ThesisExportJobStatus.SUCCESS,
          progress: 100,
          fileUrl,
          fileName,
          fileSize: buffer.length,
          finishedAt: new Date(),
        },
      });
    } catch (e) {
      if (filePath) await fs.promises.unlink(filePath).catch(() => undefined);
      const error = e instanceof Error ? e.message : '导出失败';
      await this.prisma.thesisExportJob
        .update({
          where: { id: jobId },
          data: {
            status: ThesisExportJobStatus.FAILED,
            progress: 100,
            errorMessage: error.slice(0, 1000),
            finishedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }
  }

  private async assertTaskAccess(taskId: string, actor: Actor) {
    if (actor.admin) return;
    await this.taskService.assertTaskOwnership(taskId, actor.id);
  }

  private buildTree(
    sections: Prisma.ThesisDocumentSectionGetPayload<object>[],
  ) {
    const map = new Map<string, SectionNode>();
    const roots: SectionNode[] = [];
    for (const section of sections)
      map.set(section.id, { ...section, children: [] });
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId))
        map.get(node.parentId)!.children!.push(node);
      else roots.push(node);
    }
    return roots;
  }
}
