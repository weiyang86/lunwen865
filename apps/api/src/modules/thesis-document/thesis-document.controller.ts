import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CreateAdvisorCommentDto,
  CreateDocumentSectionDto,
  MergeStageContentDto,
  QueryRevisionsDto,
  UpdateAdvisorCommentDto,
  UpdateDocumentSectionDto,
  UpdateThesisDocumentDto,
} from './dto/thesis-document.dto';
import { ThesisDocumentService } from './thesis-document.service';

function actor(id?: unknown, role?: unknown) {
  return {
    id: typeof id === 'string' ? id : '',
    role: typeof role === 'string' ? role : undefined,
  };
}

@Controller()
export class ThesisDocumentController {
  constructor(private readonly service: ThesisDocumentService) {}

  @Get('thesis-tasks/:taskId/document')
  getTaskDocument(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.getTaskDocument(taskId, actor(userId, role));
  }

  @Post('thesis-tasks/:taskId/document/init')
  initDocument(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.initDocument(taskId, actor(userId, role));
  }

  @Patch('thesis-documents/:documentId')
  updateDocument(
    @Param('documentId') documentId: string,
    @Body() dto: UpdateThesisDocumentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.updateDocument(documentId, dto, actor(userId, role));
  }

  @Post('thesis-documents/:documentId/sections')
  createSection(
    @Param('documentId') documentId: string,
    @Body() dto: CreateDocumentSectionDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.createSection(documentId, dto, actor(userId, role));
  }

  @Patch('thesis-document-sections/:sectionId')
  updateSection(
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateDocumentSectionDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.updateSection(sectionId, dto, actor(userId, role));
  }

  @Delete('thesis-document-sections/:sectionId')
  deleteSection(
    @Param('sectionId') sectionId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.deleteSection(sectionId, actor(userId, role));
  }

  @Post('thesis-documents/:documentId/merge-stage-content')
  mergeStageContent(
    @Param('documentId') documentId: string,
    @Body() dto: MergeStageContentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.mergeStageContent(documentId, dto, actor(userId, role));
  }

  @Get('thesis-documents/:documentId/revisions')
  listRevisions(
    @Param('documentId') documentId: string,
    @Query() q: QueryRevisionsDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.listRevisions(documentId, q, actor(userId, role));
  }

  @Post('thesis-documents/:documentId/advisor-comments')
  createAdvisorComment(
    @Param('documentId') documentId: string,
    @Body() dto: CreateAdvisorCommentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.createAdvisorComment(
      documentId,
      dto,
      actor(userId, role),
    );
  }

  @Patch('thesis-advisor-comments/:commentId')
  updateAdvisorComment(
    @Param('commentId') commentId: string,
    @Body() dto: UpdateAdvisorCommentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.updateAdvisorComment(
      commentId,
      dto,
      actor(userId, role),
    );
  }
}
