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
  CreateThesisSkillBindingDto,
  CreateThesisSkillDto,
  CreateThesisSkillVersionDto,
  ListThesisSkillRunsDto,
  ListThesisSkillsDto,
  TestRunThesisSkillDto,
  UpdateThesisSkillBindingDto,
  UpdateThesisSkillDto,
  UpdateThesisSkillVersionDto,
} from './dto/thesis-skill.dto';
import { ThesisSkillService } from './thesis-skill.service';

@Controller('admin/thesis-skills')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminThesisSkillController {
  constructor(private readonly thesisSkillService: ThesisSkillService) {}

  @Get()
  listSkills(@Query() query: ListThesisSkillsDto) {
    return this.thesisSkillService.listSkills(query);
  }

  @Post()
  createSkill(@Body() dto: CreateThesisSkillDto) {
    return this.thesisSkillService.createSkill(dto);
  }

  @Get('runs')
  listRuns(@Query() query: ListThesisSkillRunsDto) {
    return this.thesisSkillService.listSkillRuns(query);
  }

  @Get('runs/:id')
  runDetail(@Param('id') id: string) {
    return this.thesisSkillService.getSkillRunDetail(id);
  }

  @Get('versions/:versionId')
  versionDetail(@Param('versionId') versionId: string) {
    return this.thesisSkillService.getVersionDetail(versionId);
  }

  @Patch('versions/:versionId')
  updateVersion(
    @Param('versionId') versionId: string,
    @Body() dto: UpdateThesisSkillVersionDto,
  ) {
    return this.thesisSkillService.updateSkillVersion(versionId, dto);
  }

  @Post('versions/:versionId/activate')
  activateVersion(@Param('versionId') versionId: string) {
    return this.thesisSkillService.activateSkillVersion(versionId);
  }

  @Patch('bindings/:bindingId')
  updateBinding(
    @Param('bindingId') bindingId: string,
    @Body() dto: UpdateThesisSkillBindingDto,
  ) {
    return this.thesisSkillService.updateSkillBinding(bindingId, dto);
  }

  @Delete('bindings/:bindingId')
  deleteBinding(@Param('bindingId') bindingId: string) {
    return this.thesisSkillService.disableSkillBinding(bindingId);
  }

  @Get(':id')
  skillDetail(@Param('id') id: string) {
    return this.thesisSkillService.getSkillDetail(id);
  }

  @Patch(':id')
  updateSkill(@Param('id') id: string, @Body() dto: UpdateThesisSkillDto) {
    return this.thesisSkillService.updateSkill(id, dto);
  }

  @Delete(':id')
  deleteSkill(@Param('id') id: string) {
    return this.thesisSkillService.disableSkill(id);
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string) {
    return this.thesisSkillService.listVersions(id);
  }

  @Post(':id/versions')
  createVersion(
    @Param('id') id: string,
    @Body() dto: CreateThesisSkillVersionDto,
  ) {
    return this.thesisSkillService.createSkillVersion(id, dto);
  }

  @Get(':id/bindings')
  listBindings(@Param('id') id: string) {
    return this.thesisSkillService.listBindings(id);
  }

  @Post(':id/bindings')
  createBinding(
    @Param('id') id: string,
    @Body() dto: CreateThesisSkillBindingDto,
  ) {
    return this.thesisSkillService.createSkillBinding(id, dto);
  }

  @Post(':id/test-run')
  testRun(@Param('id') id: string, @Body() dto: TestRunThesisSkillDto) {
    return this.thesisSkillService.testRunSkill(id, dto);
  }
}
