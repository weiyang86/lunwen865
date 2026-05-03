import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminPolishService } from './admin-polish.service';
import { QueryPolishDto } from './dto/query-polish.dto';

@Controller('admin/polish')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminPolishController {
  constructor(private readonly adminPolishService: AdminPolishService) {}

  @Get()
  @ApiOperation({ summary: '跨用户查询任务' })
  list(@Query() query: QueryPolishDto & { userId?: string }) {
    return this.adminPolishService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: '全平台统计' })
  stats() {
    return this.adminPolishService.getGlobalStats();
  }

  @Get(':id')
  @ApiOperation({ summary: '任务详情' })
  findOne(@Param('id') id: string) {
    return this.adminPolishService.findOne(id);
  }
}
