import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ThesisFormatTemplateStatus,
  ThesisWordFileStatus,
  ThesisWordFileVersionSourceType,
} from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskService } from '../task/task.service';
import { ThesisDocxExportService } from '../export/thesis-docx-export.service';
import { ThesisExportTemplateService } from '../export/thesis-export-template.service';
import { sanitizeFilename } from '../export/utils/filename.util';
import type { GenerateDocxDto } from './dto/generate-docx.dto';

type Actor = { id: string; role?: string; admin?: boolean };
type SectionNode = Prisma.ThesisDocumentSectionGetPayload<object> & {
  children?: SectionNode[];
};

@Injectable()
export class ThesisWordFileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
    private readonly docx: ThesisDocxExportService,
    private readonly templateService: ThesisExportTemplateService,
  ) {}

  async generateDocx(documentId: string, dto: GenerateDocxDto, actor: Actor) {
    const document = await this.getDocumentWithAccess(documentId, actor);
    const sections = await this.prisma.thesisDocumentSection.findMany({
      where: { documentId, deletedAt: null },
      orderBy: [
        { parentId: 'asc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    const hasContent = sections.some(
      (section) =>
        (section.content ?? section.plainText ?? '')
          .replace(/<[^>]+>/g, '')
          .trim().length > 0,
    );
    if (!sections.length || !hasContent) {
      throw new BadRequestException(
        '当前论文文档暂无可生成内容，请先完善章节内容。',
      );
    }

    const setting = await this.resolveFormatSetting(document, dto.templateId);
    const tree = this.buildTree(sections);
    const buffer = await this.docx.build({
      title: document.title,
      abstract: document.abstract,
      keywords: document.keywords,
      sections: tree,
      rules: setting.template?.rules ?? [],
      overrideRules: setting.overrideRules,
    });

    const existed = await this.prisma.thesisWordFile.findUnique({
      where: { documentId },
    });
    const nextVersion = (existed?.currentVersion ?? 0) + 1;
    const dir = path.join(
      process.cwd(),
      'storage',
      'thesis-word-files',
      document.taskId,
      document.id,
    );
    await fs.promises.mkdir(dir, { recursive: true });
    const fileName = sanitizeFilename(
      `${document.title || document.id}-v${nextVersion}.docx`,
    );
    const filePath = path.join(dir, `v${nextVersion}.docx`);
    await fs.promises.writeFile(filePath, buffer);

    const wordFile = existed
      ? await this.prisma.thesisWordFile.update({
          where: { id: existed.id },
          data: {
            fileName,
            fileUrl: `/api/thesis-word-files/${existed.id}/download`,
            currentVersion: nextVersion,
            status: ThesisWordFileStatus.GENERATED,
          },
        })
      : await this.prisma.thesisWordFile.create({
          data: {
            taskId: document.taskId,
            documentId: document.id,
            fileName,
            fileUrl: '',
            currentVersion: nextVersion,
            status: ThesisWordFileStatus.GENERATED,
          },
        });

    if (!wordFile.fileUrl) {
      await this.prisma.thesisWordFile.update({
        where: { id: wordFile.id },
        data: { fileUrl: `/api/thesis-word-files/${wordFile.id}/download` },
      });
    }

    const snapshot = JSON.parse(
      JSON.stringify({
        templateId: setting.template?.id ?? null,
        templateName: setting.template?.name ?? null,
        rules: setting.template?.rules ?? [],
        overrideRules: setting.overrideRules ?? null,
        customRequirement: setting.customRequirement ?? null,
        generatedAt: new Date().toISOString(),
      }),
    ) as Prisma.InputJsonValue;

    const version = await this.prisma.thesisWordFileVersion.create({
      data: {
        wordFileId: wordFile.id,
        version: nextVersion,
        fileName,
        fileUrl: '',
        fileSize: buffer.length,
        sourceType: ThesisWordFileVersionSourceType.GENERATED_FROM_DOCUMENT,
        sourceDocumentVersion: document.currentVersion,
        formatTemplateId: setting.template?.id ?? null,
        formatSettingSnapshot: snapshot,
        operatorId: actor.id || null,
      },
    });
    const versionUrl = `/api/thesis-word-file-versions/${version.id}/download`;
    const updatedVersion = await this.prisma.thesisWordFileVersion.update({
      where: { id: version.id },
      data: { fileUrl: versionUrl },
      include: {
        formatTemplate: { select: { id: true, name: true, code: true } },
      },
    });
    const updatedWordFile = await this.prisma.thesisWordFile.update({
      where: { id: wordFile.id },
      data: { fileUrl: `/api/thesis-word-files/${wordFile.id}/download` },
    });

    return {
      wordFile: updatedWordFile,
      version: updatedVersion,
      downloadUrl: updatedWordFile.fileUrl,
    };
  }

  async listByTask(taskId: string, actor: Actor) {
    await this.assertTaskAccess(taskId, actor);
    const items = await this.prisma.thesisWordFile.findMany({
      where: { taskId },
      orderBy: { updatedAt: 'desc' },
      include: {
        document: { select: { id: true, title: true, currentVersion: true } },
        versions: { orderBy: { version: 'desc' }, take: 5 },
      },
    });
    return { items, current: items[0] ?? null };
  }

  async getWordFile(id: string, actor: Actor) {
    const wordFile = await this.prisma.thesisWordFile.findUnique({
      where: { id },
      include: {
        task: { select: { id: true, userId: true, title: true } },
        document: { select: { id: true, title: true, currentVersion: true } },
        versions: {
          orderBy: { version: 'desc' },
          include: {
            formatTemplate: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    if (!wordFile) throw new NotFoundException('Word 初稿文件不存在');
    if (!actor.admin && wordFile.task.userId !== actor.id)
      throw new ForbiddenException('无权访问该 Word 文件');
    return wordFile;
  }

  async listVersions(id: string, actor: Actor) {
    const wordFile = await this.getWordFile(id, actor);
    return { items: wordFile.versions };
  }

  async getWordFileDownload(id: string, actor: Actor) {
    const wordFile = await this.getWordFile(id, actor);
    const version = wordFile.versions.find(
      (item) => item.version === wordFile.currentVersion,
    );
    if (!version)
      throw new BadRequestException('文件不存在或已被清理，请重新生成。');
    return this.versionDownloadInfo(version.id, actor);
  }

  async versionDownloadInfo(versionId: string, actor: Actor) {
    const version = await this.prisma.thesisWordFileVersion.findUnique({
      where: { id: versionId },
      include: {
        wordFile: { include: { task: { select: { userId: true } } } },
      },
    });
    if (!version) throw new NotFoundException('Word 文件版本不存在');
    if (!actor.admin && version.wordFile.task.userId !== actor.id)
      throw new ForbiddenException('无权下载该 Word 文件版本');
    const filePath = path.join(
      process.cwd(),
      'storage',
      'thesis-word-files',
      version.wordFile.taskId,
      version.wordFile.documentId,
      `v${version.version}.docx`,
    );
    try {
      await fs.promises.stat(filePath);
    } catch {
      throw new BadRequestException('文件不存在或已被清理，请重新生成。');
    }
    return { filePath, fileName: version.fileName };
  }

  private async getDocumentWithAccess(documentId: string, actor: Actor) {
    const document = await this.prisma.thesisDocument.findUnique({
      where: { id: documentId },
      include: { task: { select: { id: true, userId: true, title: true } } },
    });
    if (!document) throw new NotFoundException('请先初始化合稿文档。');
    if (!actor.admin && document.task.userId !== actor.id)
      throw new ForbiddenException('无权访问该论文文档');
    return document;
  }

  private async resolveFormatSetting(
    document: Prisma.ThesisDocumentGetPayload<{
      include: { task: { select: { id: true; userId: true; title: true } } };
    }>,
    templateId?: string,
  ) {
    let setting = await this.prisma.thesisDocumentFormatSetting.findUnique({
      where: { documentId: document.id },
      include: { template: { include: { rules: true } } },
    });
    if (templateId) {
      const template = await this.prisma.thesisFormatTemplate.findFirst({
        where: { id: templateId, status: ThesisFormatTemplateStatus.ENABLED },
        include: { rules: true },
      });
      if (!template) {
        return {
          template: null,
          overrideRules: setting?.overrideRules ?? null,
          customRequirement: setting?.customRequirement ?? null,
        };
      }
      setting = await this.prisma.thesisDocumentFormatSetting.upsert({
        where: { documentId: document.id },
        update: { templateId: template.id },
        create: { documentId: document.id, templateId: template.id },
        include: { template: { include: { rules: true } } },
      });
    }
    if (setting?.template) return setting;
    try {
      const template = await this.templateService.getDefaultTemplateForTask(
        document.taskId,
        { stage: 'FULL_PAPER', exportFormat: 'DOCX' },
      );
      return {
        template: await this.prisma.thesisFormatTemplate.findUnique({
          where: { id: template.id },
          include: { rules: true },
        }),
        overrideRules: setting?.overrideRules ?? null,
        customRequirement: setting?.customRequirement ?? null,
      };
    } catch {
      return {
        template: null,
        overrideRules: setting?.overrideRules ?? null,
        customRequirement: setting?.customRequirement ?? null,
      };
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
