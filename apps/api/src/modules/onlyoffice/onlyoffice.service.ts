import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ThesisWordFileStatus,
  ThesisWordFileVersionSourceType,
} from '@prisma/client';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { sanitizeFilename } from '../export/utils/filename.util';
import type { OnlyOfficeCallbackBody } from './types/onlyoffice.types';
import { OnlyOfficeConfigService } from './onlyoffice-config.service';

type Actor = { id: string; name?: string; role?: string; admin?: boolean };
type SignedQuery = { expires?: string; signature?: string; userId?: string };

const SAVE_STATUSES = new Set([2, 6]);
const ERROR_STATUSES = new Set([3, 7]);

@Injectable()
export class OnlyOfficeService {
  private readonly logger = new Logger(OnlyOfficeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: OnlyOfficeConfigService,
  ) {}

  async getEditorConfig(wordFileId: string, actor: Actor) {
    if (!this.config.documentServerUrl) {
      throw new BadRequestException('在线 Word 编辑服务未配置，请联系管理员。');
    }
    if (this.config.jwtEnabled && !this.config.jwtSecret) {
      throw new BadRequestException(
        'ONLYOFFICE JWT_SECRET 未配置，请联系管理员。',
      );
    }
    const wordFile = await this.getWordFileWithAccess(wordFileId, actor);
    const currentVersion = this.currentVersion(wordFile);
    if (!currentVersion) {
      throw new BadRequestException('当前 Word 文件不存在，请重新生成。');
    }
    const expires = Math.floor(Date.now() / 1000) + 60 * 60;
    const fileSignature = this.config.signSystemUrl({
      wordFileId,
      version: currentVersion.version,
      expires,
    });
    const callbackSignature = this.config.signSystemUrl({
      wordFileId,
      userId: actor.id,
      expires,
    });
    const fileBase =
      this.config.filePublicBaseUrl || this.config.callbackBaseUrl;
    const callbackBase = this.config.callbackBaseUrl;
    if (!fileBase || !callbackBase) {
      throw new BadRequestException('在线 Word 编辑服务未配置，请联系管理员。');
    }
    const documentKey = this.buildDocumentKey(
      wordFile.id,
      currentVersion.version,
      wordFile.updatedAt,
    );
    if (wordFile.onlyofficeDocumentKey !== documentKey) {
      await this.prisma.thesisWordFile.update({
        where: { id: wordFile.id },
        data: { onlyofficeDocumentKey: documentKey, lockStatus: 'EDITING' },
      });
    }
    const editorConfig: Record<string, unknown> = {
      document: {
        fileType: 'docx',
        key: documentKey,
        title: wordFile.fileName,
        url: `${fileBase}/api/onlyoffice/files/word-files/${wordFile.id}/current?expires=${expires}&signature=${fileSignature}`,
        permissions: {
          edit: true,
          download: true,
          print: true,
          review: true,
        },
      },
      documentType: 'word',
      editorConfig: {
        mode: this.config.editorMode,
        lang: 'zh-CN',
        callbackUrl: `${callbackBase}/api/onlyoffice/callback/${wordFile.id}?userId=${encodeURIComponent(actor.id)}&expires=${expires}&signature=${callbackSignature}`,
        user: {
          id: actor.id,
          name: actor.name || actor.id || '论文通用户',
        },
        customization: {
          autosave: true,
          forcesave: this.config.forceSaveEnabled,
        },
      },
      height: '100%',
      width: '100%',
    };
    const warnings: string[] = [];
    if (!this.config.jwtEnabled) {
      warnings.push('ONLYOFFICE JWT 未启用，仅建议本地开发或内网测试使用。');
    }
    if (this.config.jwtEnabled) {
      editorConfig.token = this.config.signJwt(editorConfig);
    }
    return {
      documentServerUrl: this.config.documentServerUrl,
      editorConfig,
      wordFile,
      currentVersion,
      warnings,
    };
  }

  async handleCallback(
    wordFileId: string,
    query: SignedQuery,
    body: OnlyOfficeCallbackBody,
    authHeader?: string,
  ) {
    const expires = Number(query.expires);
    if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) {
      this.logger.warn(
        `OnlyOffice callback signature expired for wordFile=${wordFileId}`,
      );
      return { error: 1 };
    }
    if (
      !this.config.verifySystemUrl(
        { wordFileId, userId: query.userId, expires },
        query.signature,
      )
    ) {
      this.logger.warn(
        `OnlyOffice callback signature invalid for wordFile=${wordFileId}`,
      );
      return { error: 1 };
    }
    if (this.config.jwtEnabled) {
      if (!this.config.jwtSecret) {
        this.logger.warn(
          `OnlyOffice callback JWT secret missing for wordFile=${wordFileId}`,
        );
        return { error: 1 };
      }
      const bearer = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : undefined;
      if (!this.config.verifyJwt(body.token || bearer)) {
        this.logger.warn(
          `OnlyOffice callback JWT invalid for wordFile=${wordFileId}`,
        );
        return { error: 1 };
      }
    }
    try {
      const status = Number(body.status);
      if (SAVE_STATUSES.has(status)) {
        if (!body.url) {
          this.logger.warn(
            `OnlyOffice save callback missing url for wordFile=${wordFileId}`,
          );
          return { error: 1 };
        }
        await this.saveCallbackVersion(wordFileId, query.userId, body);
        return { error: 0 };
      }
      if (ERROR_STATUSES.has(status)) {
        this.logger.error(
          `OnlyOffice save error status=${status} wordFile=${wordFileId}`,
        );
        return { error: 0 };
      }
      if (status === 1) {
        await this.prisma.thesisWordFile
          .update({
            where: { id: wordFileId },
            data: {
              lockStatus: 'EDITING',
              editingSessionKey: body.key ?? undefined,
            },
          })
          .catch(() => undefined);
      }
      if (status === 4) {
        await this.prisma.thesisWordFile
          .update({
            where: { id: wordFileId },
            data: { lockStatus: 'CLOSED' },
          })
          .catch(() => undefined);
      }
      return { error: 0 };
    } catch (error) {
      this.logger.error(
        `OnlyOffice callback failed for wordFile=${wordFileId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { error: 1 };
    }
  }

  async currentFileDownload(wordFileId: string, query: SignedQuery) {
    const expires = Number(query.expires);
    if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) {
      throw new ForbiddenException('文件访问签名已过期');
    }
    const wordFile = await this.prisma.thesisWordFile.findUnique({
      where: { id: wordFileId },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!wordFile)
      throw new NotFoundException('当前 Word 文件不存在，请重新生成。');
    const version = wordFile.versions.find(
      (item) => item.version === wordFile.currentVersion,
    );
    if (!version)
      throw new NotFoundException('当前 Word 文件不存在，请重新生成。');
    const valid = this.config.verifySystemUrl(
      { wordFileId, version: version.version, expires },
      query.signature,
    );
    if (!valid) throw new ForbiddenException('文件访问签名无效');
    return this.versionFileInfo(
      wordFile.taskId,
      wordFile.documentId,
      version.version,
      version.fileName,
    );
  }

  async versionFileDownload(versionId: string, query: SignedQuery) {
    const expires = Number(query.expires);
    if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) {
      throw new ForbiddenException('文件访问签名已过期');
    }
    if (!this.config.verifySystemUrl({ versionId, expires }, query.signature)) {
      throw new ForbiddenException('文件访问签名无效');
    }
    const version = await this.prisma.thesisWordFileVersion.findUnique({
      where: { id: versionId },
      include: { wordFile: true },
    });
    if (!version) throw new NotFoundException('Word 文件版本不存在');
    return this.versionFileInfo(
      version.wordFile.taskId,
      version.wordFile.documentId,
      version.version,
      version.fileName,
    );
  }

  private async saveCallbackVersion(
    wordFileId: string,
    userId: string | undefined,
    body: OnlyOfficeCallbackBody,
  ) {
    const wordFile = await this.prisma.thesisWordFile.findUnique({
      where: { id: wordFileId },
      include: { document: { select: { currentVersion: true } } },
    });
    if (!wordFile)
      throw new NotFoundException('当前 Word 文件不存在，请重新生成。');
    const response = await fetch(body.url!);
    if (!response.ok) throw new BadRequestException('callback 下载文件失败');
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const existed = await this.prisma.thesisWordFileVersion.findFirst({
      where: {
        wordFileId,
        checksum,
        sourceType: ThesisWordFileVersionSourceType.ONLYOFFICE_EDITED,
      },
    });
    if (existed) {
      await this.prisma.thesisWordFile.update({
        where: { id: wordFileId },
        data: {
          lockStatus: 'SAVED',
          lastEditedAt: new Date(),
          lastEditedBy: userId ?? null,
        },
      });
      return existed;
    }
    const nextVersion = wordFile.currentVersion + 1;
    const dir = path.join(
      process.cwd(),
      'storage',
      'thesis-word-files',
      wordFile.taskId,
      wordFile.documentId,
    );
    await fs.promises.mkdir(dir, { recursive: true });
    const fileName = sanitizeFilename(
      `${wordFile.fileName.replace(/\.docx$/i, '')}-oo-v${nextVersion}.docx`,
    );
    const filePath = path.join(dir, `v${nextVersion}.docx`);
    await fs.promises.writeFile(filePath, buffer);
    const payloadSnapshot = JSON.parse(
      JSON.stringify({
        key: body.key,
        status: body.status,
        users: body.users,
        history: body.history,
        changesurl: body.changesurl,
        forcesavetype: body.forcesavetype,
        savedAt: new Date().toISOString(),
      }),
    ) as Prisma.InputJsonValue;
    const version = await this.prisma.thesisWordFileVersion.create({
      data: {
        wordFileId,
        version: nextVersion,
        fileName,
        fileUrl: '',
        fileSize: buffer.length,
        sourceType: ThesisWordFileVersionSourceType.ONLYOFFICE_EDITED,
        sourceDocumentVersion: wordFile.document.currentVersion,
        operatorId: userId ?? null,
        editorUserId: userId ?? null,
        callbackPayload: payloadSnapshot,
        checksum,
      },
    });
    const versionUrl = `/api/thesis-word-file-versions/${version.id}/download`;
    await this.prisma.thesisWordFileVersion.update({
      where: { id: version.id },
      data: { fileUrl: versionUrl },
    });
    const documentKey = this.buildDocumentKey(
      wordFile.id,
      nextVersion,
      new Date(),
    );
    await this.prisma.thesisWordFile.update({
      where: { id: wordFileId },
      data: {
        fileName,
        fileUrl: `/api/thesis-word-files/${wordFileId}/download`,
        currentVersion: nextVersion,
        status: ThesisWordFileStatus.EDITING,
        editingSessionKey: body.key ?? null,
        lastEditedAt: new Date(),
        lastEditedBy: userId ?? null,
        lockStatus: 'SAVED',
        onlyofficeDocumentKey: documentKey,
      },
    });
    return version;
  }

  private async getWordFileWithAccess(wordFileId: string, actor: Actor) {
    const wordFile = await this.prisma.thesisWordFile.findUnique({
      where: { id: wordFileId },
      include: {
        task: { select: { id: true, userId: true, title: true } },
        document: { select: { id: true, title: true, currentVersion: true } },
        versions: { orderBy: { version: 'desc' } },
      },
    });
    if (!wordFile)
      throw new NotFoundException('当前 Word 文件不存在，请重新生成。');
    if (!actor.admin && wordFile.task.userId !== actor.id) {
      throw new ForbiddenException('无权访问该 Word 文件');
    }
    return wordFile;
  }

  private currentVersion(
    wordFile: Prisma.ThesisWordFileGetPayload<{
      include: {
        task: { select: { id: true; userId: true; title: true } };
        document: { select: { id: true; title: true; currentVersion: true } };
        versions: true;
      };
    }>,
  ) {
    return (
      wordFile.versions.find(
        (item) => item.version === wordFile.currentVersion,
      ) ?? wordFile.versions[0]
    );
  }

  private buildDocumentKey(
    wordFileId: string,
    version: number,
    updatedAt: Date,
  ) {
    return crypto
      .createHash('sha1')
      .update(`${wordFileId}:${version}:${updatedAt.toISOString()}`)
      .digest('hex')
      .slice(0, 32);
  }

  private async versionFileInfo(
    taskId: string,
    documentId: string,
    version: number,
    fileName: string,
  ) {
    const filePath = path.join(
      process.cwd(),
      'storage',
      'thesis-word-files',
      taskId,
      documentId,
      `v${version}.docx`,
    );
    try {
      await fs.promises.stat(filePath);
    } catch {
      throw new NotFoundException('当前 Word 文件不存在，请重新生成。');
    }
    return { filePath, fileName };
  }
}
