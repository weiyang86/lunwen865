import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'node:fs';
import { Observable } from 'rxjs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateExportDto } from './dto/create-export.dto';
import { QueryExportDto } from './dto/query-export.dto';
import { ExportService } from './export.service';
import { ExportStatus } from '@prisma/client';

@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post()
  create(@CurrentUser('id') uid: string, @Body() dto: CreateExportDto) {
    return this.exportService.create(uid, dto);
  }

  @Get()
  findAll(@CurrentUser('id') uid: string, @Query() q: QueryExportDto) {
    return this.exportService.findAll(uid, q);
  }

  @Get('templates')
  listTemplates() {
    return [
      {
        key: 'GENERIC',
        name: '通用格式',
        description: '宋体小四，1.5 倍行距，无封面，适合一般用途',
      },
      {
        key: 'UNDERGRADUATE',
        name: '本科论文',
        description: '含封面，左 3cm 装订边距，符合多数本科要求',
      },
      {
        key: 'MASTER',
        name: '硕士论文',
        description: '双倍行距，含封面，宽边距，符合硕士论文规范',
      },
    ];
  }

  @Get(':id')
  findOne(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.exportService.findOne(uid, id);
  }

  @Get(':id/download')
  async download(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { filePath, fileName } = await this.exportService.getDownloadInfo(
      uid,
      id,
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

  @Sse(':id/stream')
  stream(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((observer) => {
      let done = false;

      const run = async () => {
        try {
          for await (const evt of this.exportService.streamProgress(uid, id)) {
            if (done) return;
            observer.next({ data: evt });
            if (
              evt.status === ExportStatus.SUCCESS ||
              evt.status === ExportStatus.FAILED ||
              evt.status === ExportStatus.EXPIRED
            ) {
              done = true;
              observer.complete();
              return;
            }
          }
          if (!done) observer.complete();
        } catch (e) {
          if (done) return;
          done = true;
          observer.error(e);
        }
      };

      void run();
      return () => {
        done = true;
      };
    });
  }

  @Post(':id/retry')
  retry(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.exportService.retry(uid, id);
  }

  @Delete(':id')
  async delete(@CurrentUser('id') uid: string, @Param('id') id: string) {
    await this.exportService.delete(uid, id);
    return { success: true };
  }
}
