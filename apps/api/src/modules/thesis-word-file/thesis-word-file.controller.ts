import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'node:fs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GenerateDocxDto } from './dto/generate-docx.dto';
import { ThesisWordFileService } from './thesis-word-file.service';

function actor(id?: unknown, role?: unknown) {
  const roleText = typeof role === 'string' ? role : undefined;
  return {
    id: typeof id === 'string' ? id : '',
    role: roleText,
    admin:
      roleText === 'ADMIN' ||
      roleText === 'SUPER_ADMIN' ||
      roleText === 'TUTOR',
  };
}

@Controller()
export class ThesisWordFileController {
  constructor(private readonly service: ThesisWordFileService) {}

  @Post('thesis-documents/:documentId/generate-docx')
  generateDocx(
    @Param('documentId') documentId: string,
    @Body() dto: GenerateDocxDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.generateDocx(documentId, dto, actor(userId, role));
  }

  @Get('thesis-tasks/:taskId/word-files')
  listByTask(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.listByTask(taskId, actor(userId, role));
  }

  @Get('thesis-word-files/:id')
  getWordFile(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.getWordFile(id, actor(userId, role));
  }

  @Get('thesis-word-files/:id/versions')
  listVersions(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.listVersions(id, actor(userId, role));
  }

  @Get('thesis-word-files/:id/download')
  async downloadWordFile(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Res() res: Response,
  ) {
    const info = await this.service.getWordFileDownload(
      id,
      actor(userId, role),
    );
    this.pipeDocx(info, res);
  }

  @Get('thesis-word-file-versions/:versionId/download')
  async downloadVersion(
    @Param('versionId') versionId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Res() res: Response,
  ) {
    const info = await this.service.versionDownloadInfo(
      versionId,
      actor(userId, role),
    );
    this.pipeDocx(info, res);
  }

  private pipeDocx(
    info: { filePath: string; fileName: string },
    res: Response,
  ) {
    const encoded = encodeURIComponent(info.fileName || 'thesis.docx');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encoded}`,
    );
    fs.createReadStream(info.filePath).pipe(res);
  }
}
