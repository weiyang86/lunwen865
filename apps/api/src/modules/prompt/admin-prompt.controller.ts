import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole, PromptScene } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminPromptService } from './admin-prompt.service';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { PublishPromptDto } from './dto/publish-prompt.dto';
import { QueryPromptDto } from './dto/query-prompt.dto';
import { RenderTestDto } from './dto/render-test.dto';
import { RestoreVersionDto } from './dto/restore-version.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';

@Controller('admin/prompt-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminPromptController {
  constructor(private readonly adminService: AdminPromptService) {}

  @Get('meta/scenes')
  scenes() {
    return Object.values(PromptScene).map((v) => ({
      value: v,
      label: this.adminService.sceneLabel(v),
    }));
  }

  @Get()
  list(@Query() q: QueryPromptDto) {
    return this.adminService.list(q);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminService.findOne(id);
  }

  @Post()
  create(@CurrentUser('id') uid: string, @Body() dto: CreatePromptDto) {
    return this.adminService.create(uid, dto);
  }

  @Put(':id')
  update(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: UpdatePromptDto,
  ) {
    return this.adminService.update(uid, id, dto);
  }

  @Post(':id/publish')
  publish(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: PublishPromptDto,
  ) {
    return this.adminService.publish(uid, id, dto);
  }

  @Post(':id/archive')
  archive(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.adminService.archive(uid, id);
  }

  @Get(':id/versions')
  versions(@Param('id') id: string) {
    return this.adminService.versions(id);
  }

  @Get(':id/versions/:version')
  versionDetail(@Param('id') id: string, @Param('version') v: string) {
    return this.adminService.versionDetail(id, Number(v));
  }

  @Get(':id/diff')
  diff(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.adminService.diff(id, Number(from), Number(to));
  }

  @Post(':id/restore')
  restore(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: RestoreVersionDto,
  ) {
    return this.adminService.restore(uid, id, dto.version);
  }

  @Post(':id/test-render')
  testRender(@Param('id') id: string, @Body() dto: RenderTestDto) {
    return this.adminService.testRender(id, dto.vars ?? {});
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adminService.remove(id);
  }
}
