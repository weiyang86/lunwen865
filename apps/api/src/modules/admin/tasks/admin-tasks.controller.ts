import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AddAdminNoteDto } from './dto/add-admin-note.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { BatchAssignTasksDto } from './dto/batch-assign-tasks.dto';
import { BatchOverrideStatusDto } from './dto/batch-override-status.dto';
import { BatchUnlinkOrdersDto } from './dto/batch-unlink-orders.dto';
import { ListAdminTasksDto } from './dto/list-admin-tasks.dto';
import { OverrideTaskStatusDto } from './dto/override-task-status.dto';
import { AdminTasksService } from './admin-tasks.service';

@Controller('admin/tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminTasksController {
  constructor(private readonly service: AdminTasksService) {}

  @Get()
  list(@Query() dto: ListAdminTasksDto) {
    return this.service.list(dto);
  }

  @Get('export')
  async exportCsv(
    @Query() dto: ListAdminTasksDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { filename, stream, content } = await this.service.exportCsv(dto);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    if (stream) {
      stream.pipe(res);
      return;
    }
    res.send(content ?? '');
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  @Patch(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
    @CurrentUser('id') operatorId: string,
  ) {
    return this.service.assign(id, dto.assigneeId, operatorId);
  }

  @Patch(':id/unassign')
  unassign(@Param('id') id: string, @CurrentUser('id') operatorId: string) {
    return this.service.unassign(id, operatorId);
  }

  @Patch(':id/override-status')
  overrideStatus(
    @Param('id') id: string,
    @Body() dto: OverrideTaskStatusDto,
    @CurrentUser('id') operatorId: string,
  ) {
    return this.service.overrideStatus(
      id,
      dto.targetStatus,
      dto.reason,
      operatorId,
    );
  }

  @Post(':id/admin-note')
  addAdminNote(
    @Param('id') id: string,
    @Body() dto: AddAdminNoteDto,
    @CurrentUser('id') operatorId: string,
  ) {
    return this.service.addAdminNote(id, dto.content, operatorId);
  }

  @Post('batch/assign')
  batchAssign(
    @Body() dto: BatchAssignTasksDto,
    @CurrentUser('id') operatorId: string,
  ) {
    return this.service.batchAssign(dto.ids, dto.assigneeId, operatorId);
  }

  @Post('batch/override-status')
  batchOverrideStatus(
    @Body() dto: BatchOverrideStatusDto,
    @CurrentUser('id') operatorId: string,
  ) {
    return this.service.batchOverrideStatus(
      dto.ids,
      dto.targetStatus,
      dto.reason,
      operatorId,
    );
  }

  @Post('batch/unlink-orders')
  batchUnlinkOrders(
    @Body() dto: BatchUnlinkOrdersDto,
    @CurrentUser('id') operatorId: string,
  ) {
    return this.service.batchUnlinkOrders(dto.ids, operatorId);
  }
}
