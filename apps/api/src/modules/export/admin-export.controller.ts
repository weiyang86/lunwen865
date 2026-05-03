import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QueryExportDto } from './dto/query-export.dto';
import { AdminExportService } from './admin-export.service';

@Controller('admin/export')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminExportController {
  constructor(private readonly adminExportService: AdminExportService) {}

  @Get('stats')
  stats() {
    return this.adminExportService.getStats();
  }

  @Get()
  findAll(@Query() query: QueryExportDto) {
    return this.adminExportService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminExportService.findOne(id);
  }

  @Delete(':id')
  async forceDelete(@Param('id') id: string) {
    await this.adminExportService.forceDelete(id);
    return { success: true };
  }
}
