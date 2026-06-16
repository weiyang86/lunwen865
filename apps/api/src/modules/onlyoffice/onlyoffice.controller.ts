import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'node:fs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OnlyOfficeService } from './onlyoffice.service';
import type { OnlyOfficeCallbackBody } from './types/onlyoffice.types';

function actor(id?: unknown, role?: unknown, email?: unknown, name?: unknown) {
  const roleText = typeof role === 'string' ? role : undefined;
  return {
    id: typeof id === 'string' ? id : '',
    name:
      typeof name === 'string'
        ? name
        : typeof email === 'string'
          ? email
          : undefined,
    role: roleText,
    admin:
      roleText === 'ADMIN' ||
      roleText === 'SUPER_ADMIN' ||
      roleText === 'TUTOR',
  };
}

@Controller()
export class OnlyOfficeController {
  constructor(private readonly service: OnlyOfficeService) {}

  @Get('thesis-word-files/:id/editor-config')
  editorConfig(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @CurrentUser('email') email: string,
    @CurrentUser('name') name: string,
  ) {
    return this.service.getEditorConfig(id, actor(userId, role, email, name));
  }

  @Public()
  @Post('onlyoffice/callback/:wordFileId')
  callback(
    @Param('wordFileId') wordFileId: string,
    @Query('userId') userId: string | undefined,
    @Query('expires') expires: string | undefined,
    @Query('signature') signature: string | undefined,
    @Body() body: OnlyOfficeCallbackBody,
    @Headers('authorization') authorization?: string,
  ) {
    return this.service.handleCallback(
      wordFileId,
      { userId, expires, signature },
      body,
      authorization,
    );
  }

  @Public()
  @Get('onlyoffice/files/word-files/:wordFileId/current')
  async currentFile(
    @Param('wordFileId') wordFileId: string,
    @Query('expires') expires: string | undefined,
    @Query('signature') signature: string | undefined,
    @Res() res: Response,
  ) {
    const info = await this.service.currentFileDownload(wordFileId, {
      expires,
      signature,
    });
    this.pipeDocx(info, res);
  }

  @Public()
  @Get('onlyoffice/files/word-file-versions/:versionId')
  async versionFile(
    @Param('versionId') versionId: string,
    @Query('expires') expires: string | undefined,
    @Query('signature') signature: string | undefined,
    @Res() res: Response,
  ) {
    const info = await this.service.versionFileDownload(versionId, {
      expires,
      signature,
    });
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
