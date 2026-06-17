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
import { AcademicService } from './academic.service';
import { RegionSyncService } from './region-sync.service';
import {
  CreateCollegeDto,
  CreateDisciplineCategoryDto,
  CreateDisciplineLevelOneDto,
  CreateDisciplineLevelTwoDto,
  CreateMajorDto,
  CreateSchoolDto,
  ListAcademicDto,
  QueryCollegesDto,
  QueryMajorsDto,
  QuerySchoolsDto,
  UpdateCollegeDto,
  UpdateDisciplineCategoryDto,
  UpdateDisciplineLevelOneDto,
  UpdateDisciplineLevelTwoDto,
  UpdateMajorDto,
  UpdateSchoolDto,
  ListRegionsDto,
  ListSyncLogsDto,
} from './dto/academic.dto';

@Controller('admin/academic')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminAcademicController {
  constructor(
    private readonly academicService: AcademicService,
    private readonly regionSyncService: RegionSyncService,
  ) {}

  @Get('regions')
  regions(@Query() query: ListRegionsDto) {
    return this.regionSyncService.listRegions(query);
  }

  @Get('sync/regions/amap/status')
  regionSyncStatus() {
    return this.regionSyncService.status();
  }

  @Post('sync/regions/amap/preview')
  previewRegionSync() {
    return this.regionSyncService.preview();
  }

  @Post('sync/regions/amap/confirm')
  confirmRegionSync() {
    return this.regionSyncService.confirm();
  }

  @Get('sync/logs')
  syncLogs(@Query() query: ListSyncLogsDto) {
    return this.regionSyncService.logs(query);
  }

  @Get('schools')
  schools(@Query() query: QuerySchoolsDto) {
    return this.academicService.listSchools(query, false);
  }

  @Post('schools')
  createSchool(@Body() dto: CreateSchoolDto) {
    return this.academicService.createSchool(dto);
  }

  @Patch('schools/:id')
  updateSchool(@Param('id') id: string, @Body() dto: UpdateSchoolDto) {
    return this.academicService.updateSchool(id, dto);
  }

  @Delete('schools/:id')
  deleteSchool(@Param('id') id: string) {
    return this.academicService.disableSchool(id);
  }

  @Get('colleges')
  colleges(@Query() query: QueryCollegesDto) {
    return this.academicService.listColleges(query, false);
  }

  @Post('colleges')
  createCollege(@Body() dto: CreateCollegeDto) {
    return this.academicService.createCollege(dto);
  }

  @Patch('colleges/:id')
  updateCollege(@Param('id') id: string, @Body() dto: UpdateCollegeDto) {
    return this.academicService.updateCollege(id, dto);
  }

  @Delete('colleges/:id')
  deleteCollege(@Param('id') id: string) {
    return this.academicService.disableCollege(id);
  }

  @Get('majors')
  majors(@Query() query: QueryMajorsDto) {
    return this.academicService.listMajors(query, false);
  }

  @Post('majors')
  createMajor(@Body() dto: CreateMajorDto) {
    return this.academicService.createMajor(dto);
  }

  @Patch('majors/:id')
  updateMajor(@Param('id') id: string, @Body() dto: UpdateMajorDto) {
    return this.academicService.updateMajor(id, dto);
  }

  @Delete('majors/:id')
  deleteMajor(@Param('id') id: string) {
    return this.academicService.disableMajor(id);
  }

  @Get('disciplines')
  disciplines(@Query() query: ListAcademicDto) {
    return this.academicService.listDisciplines(query);
  }

  @Post('disciplines/categories')
  createCategory(@Body() dto: CreateDisciplineCategoryDto) {
    return this.academicService.createDisciplineCategory(dto);
  }

  @Patch('disciplines/categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateDisciplineCategoryDto,
  ) {
    return this.academicService.updateDisciplineCategory(id, dto);
  }

  @Delete('disciplines/categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.academicService.disableDisciplineCategory(id);
  }

  @Post('disciplines/level-ones')
  createLevelOne(@Body() dto: CreateDisciplineLevelOneDto) {
    return this.academicService.createDisciplineLevelOne(dto);
  }

  @Patch('disciplines/level-ones/:id')
  updateLevelOne(
    @Param('id') id: string,
    @Body() dto: UpdateDisciplineLevelOneDto,
  ) {
    return this.academicService.updateDisciplineLevelOne(id, dto);
  }

  @Delete('disciplines/level-ones/:id')
  deleteLevelOne(@Param('id') id: string) {
    return this.academicService.disableDisciplineLevelOne(id);
  }

  @Post('disciplines/level-twos')
  createLevelTwo(@Body() dto: CreateDisciplineLevelTwoDto) {
    return this.academicService.createDisciplineLevelTwo(dto);
  }

  @Patch('disciplines/level-twos/:id')
  updateLevelTwo(
    @Param('id') id: string,
    @Body() dto: UpdateDisciplineLevelTwoDto,
  ) {
    return this.academicService.updateDisciplineLevelTwo(id, dto);
  }

  @Delete('disciplines/level-twos/:id')
  deleteLevelTwo(@Param('id') id: string) {
    return this.academicService.disableDisciplineLevelTwo(id);
  }
}
