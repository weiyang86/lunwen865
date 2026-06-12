import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateThesisFormatRuleDto,
  CreateThesisFormatTemplateDto,
  ListThesisExportJobsDto,
  ListThesisFormatTemplatesDto,
  UpdateThesisFormatRuleDto,
  UpdateThesisFormatTemplateDto,
} from './dto/thesis-format-template.dto';
import { ThesisExportTemplateService } from './thesis-export-template.service';
import { ThesisExportService } from './thesis-export.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminThesisFormatTemplateController {
  constructor(
    private readonly templates: ThesisExportTemplateService,
    private readonly exports: ThesisExportService,
  ) {}

  @Get('thesis-format-templates') listTemplates(
    @Query() q: ListThesisFormatTemplatesDto,
  ) {
    return this.templates.list(q);
  }
  @Post('thesis-format-templates') createTemplate(
    @Body() dto: CreateThesisFormatTemplateDto,
  ) {
    return this.templates.create(dto);
  }
  @Get('thesis-format-templates/:id') getTemplate(@Param('id') id: string) {
    return this.templates.get(id);
  }
  @Patch('thesis-format-templates/:id') updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateThesisFormatTemplateDto,
  ) {
    return this.templates.update(id, dto);
  }
  @Delete('thesis-format-templates/:id') deleteTemplate(
    @Param('id') id: string,
  ) {
    return this.templates.disable(id);
  }

  @Get('thesis-format-templates/:id/rules') listRules(@Param('id') id: string) {
    return this.templates.listRules(id);
  }
  @Post('thesis-format-templates/:id/rules') createRule(
    @Param('id') id: string,
    @Body() dto: CreateThesisFormatRuleDto,
  ) {
    return this.templates.createRule(id, dto);
  }
  @Patch('thesis-format-rules/:ruleId') updateRule(
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateThesisFormatRuleDto,
  ) {
    return this.templates.updateRule(ruleId, dto);
  }
  @Delete('thesis-format-rules/:ruleId') deleteRule(
    @Param('ruleId') ruleId: string,
  ) {
    return this.templates.deleteRule(ruleId);
  }

  @Get('thesis-export-jobs') listJobs(@Query() q: ListThesisExportJobsDto) {
    return this.exports.listAdminJobs(q);
  }
  @Get('thesis-export-jobs/:id') getJob(@Param('id') id: string) {
    return this.exports.getAdminJob(id);
  }
  @Post('thesis-export-jobs/:id/retry') retry(@Param('id') id: string) {
    return this.exports.retryAdminJob(id);
  }
}
