import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ThesisDocumentService } from './thesis-document.service';

@Controller('admin/thesis-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TUTOR)
export class AdminThesisDocumentController {
  constructor(private readonly service: ThesisDocumentService) {}

  @Get('tasks/:taskId')
  getTaskDocument(@Param('taskId') taskId: string) {
    return this.service.getAdminTaskDocument(taskId);
  }
}
