import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CatalogImportService } from './catalog-import.service';
import { CollegeDataService } from './college-data.service';

@Controller('admin/academic-data')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AcademicDataCatalogController {
  constructor(
    private readonly catalogImportService: CatalogImportService,
    private readonly collegeDataService: CollegeDataService,
  ) {}

  @Get('colleges')
  colleges(@Query() query: Record<string, string>) {
    return this.collegeDataService.list(query);
  }

  @Get('majors')
  majors(@Query() query: Record<string, string>) {
    return this.catalogImportService.listMajors(query);
  }

  @Get('disciplines')
  disciplines(@Query() query: Record<string, string>) {
    return this.catalogImportService.listDisciplines(query);
  }
}
