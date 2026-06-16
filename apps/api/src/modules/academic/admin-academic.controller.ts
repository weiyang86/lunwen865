import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AcademicService } from './academic.service';
import { Res, UploadedFile } from '@nestjs/common';
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
} from './dto/academic.dto';

@Controller('admin/academic')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminAcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Get('schools/import-template')
  async downloadSchoolImportTemplate(@Res() res: Response) {
    const buffer = await this.academicService.buildSchoolImportTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="academic-schools-import-template.xlsx"',
    );
    res.send(buffer);
  }

  @Post('schools/import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.mimetype ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel';
        if (!ok) {
          cb(new BadRequestException('只支持 Excel 文件（.xlsx/.xls）'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async importSchools(
    @UploadedFile()
    file:
      | {
          originalname?: string;
          mimetype?: string;
          buffer?: Buffer;
        }
      | undefined,
  ) {
    if (!file?.buffer || !Buffer.isBuffer(file.buffer))
      throw new BadRequestException('未收到文件');
    return this.academicService.importSchoolsFromExcel(file.buffer);
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

  @Get('colleges/import-template')
  async downloadCollegeImportTemplate(@Res() res: Response) {
    const buffer = await this.academicService.buildCollegeImportTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="academic-colleges-import-template.xlsx"',
    );
    res.send(buffer);
  }

  @Post('colleges/import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.mimetype ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel';
        if (!ok) {
          cb(new BadRequestException('只支持 Excel 文件（.xlsx/.xls）'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async importColleges(
    @UploadedFile()
    file:
      | {
          originalname?: string;
          mimetype?: string;
          buffer?: Buffer;
        }
      | undefined,
  ) {
    if (!file?.buffer || !Buffer.isBuffer(file.buffer))
      throw new BadRequestException('未收到文件');
    return this.academicService.importCollegesFromExcel(file.buffer);
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

  @Get('majors/import-template')
  async downloadMajorImportTemplate(@Res() res: Response) {
    const buffer = await this.academicService.buildMajorImportTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="academic-majors-import-template.xlsx"',
    );
    res.send(buffer);
  }

  @Post('majors/import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.mimetype ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel';
        if (!ok) {
          cb(new BadRequestException('只支持 Excel 文件（.xlsx/.xls）'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async importMajors(
    @UploadedFile()
    file:
      | {
          originalname?: string;
          mimetype?: string;
          buffer?: Buffer;
        }
      | undefined,
  ) {
    if (!file?.buffer || !Buffer.isBuffer(file.buffer))
      throw new BadRequestException('未收到文件');
    return this.academicService.importMajorsFromExcel(file.buffer);
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

  @Get('disciplines/import-template')
  async downloadDisciplineImportTemplate(@Res() res: Response) {
    const buffer = await this.academicService.buildDisciplineImportTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="academic-disciplines-import-template.xlsx"',
    );
    res.send(buffer);
  }

  @Post('disciplines/import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.mimetype ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel';
        if (!ok) {
          cb(new BadRequestException('只支持 Excel 文件（.xlsx/.xls）'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async importDisciplines(
    @UploadedFile()
    file:
      | {
          originalname?: string;
          mimetype?: string;
          buffer?: Buffer;
        }
      | undefined,
  ) {
    if (!file?.buffer || !Buffer.isBuffer(file.buffer))
      throw new BadRequestException('未收到文件');
    return this.academicService.importDisciplinesFromExcel(file.buffer);
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
