import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'node:fs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ApplyFormatTemplateDto,
  CreateThesisExportJobDto,
  ExportOptionsQueryDto,
  GetTaskFormatTemplatesDto,
  UpdateThesisDocumentFormatSettingDto,
} from './dto/thesis-format-template.dto';
import { ThesisExportService } from './thesis-export.service';
import { ThesisExportTemplateService } from './thesis-export-template.service';

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
export class ThesisExportController {
  constructor(
    private readonly service: ThesisExportService,
    private readonly templates: ThesisExportTemplateService,
  ) {}

  @Get('thesis-tasks/:taskId/format-templates')
  formatTemplates(
    @Param('taskId') taskId: string,
    @Query() query: GetTaskFormatTemplatesDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.templates.getTaskFormatTemplates(
      taskId,
      query,
      actor(userId, role),
    );
  }

  @Get('thesis-documents/:documentId/format-setting')
  getFormatSetting(
    @Param('documentId') documentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.templates.getDocumentFormatSetting(
      documentId,
      actor(userId, role),
    );
  }

  @Patch('thesis-documents/:documentId/format-setting')
  saveFormatSetting(
    @Param('documentId') documentId: string,
    @Body() dto: UpdateThesisDocumentFormatSettingDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.templates.saveDocumentFormatSetting(
      documentId,
      dto,
      actor(userId, role),
    );
  }

  @Post('thesis-documents/:documentId/apply-format-template')
  applyFormatTemplate(
    @Param('documentId') documentId: string,
    @Body() dto: ApplyFormatTemplateDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.templates.applyFormatTemplate(
      documentId,
      dto.templateId,
      dto.keepOverrides,
      actor(userId, role),
    );
  }

  @Get('thesis-tasks/:taskId/export-options')
  exportOptions(
    @Param('taskId') taskId: string,
    @Query() query: ExportOptionsQueryDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.getExportOptions(taskId, query, actor(userId, role));
  }

  @Post('thesis-tasks/:taskId/export-jobs')
  createJob(
    @Param('taskId') taskId: string,
    @Body() dto: CreateThesisExportJobDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.createJob(taskId, dto, actor(userId, role));
  }

  @Get('thesis-tasks/:taskId/export-jobs')
  listTaskJobs(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.listTaskJobs(taskId, actor(userId, role));
  }

  @Get('thesis-export-jobs/:jobId')
  getJob(
    @Param('jobId') jobId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.getJob(jobId, actor(userId, role));
  }

  @Get('thesis-export-jobs/:jobId/download')
  async download(
    @Param('jobId') jobId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Res() res: Response,
  ) {
    const { filePath, fileName } = await this.service.getDownloadInfo(
      jobId,
      actor(userId, role),
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileName)}"`,
    );
    fs.createReadStream(filePath).pipe(res);
  }
}
