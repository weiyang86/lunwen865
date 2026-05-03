import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole, QuotaType } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminQuotaService } from './admin-quota.service';
import { GrantQuotaDto } from './dto/grant-quota.dto';
import { QueryQuotaLogDto } from './dto/query-quota-log.dto';

@Controller('admin/quota')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminQuotaController {
  constructor(private readonly adminQuotaService: AdminQuotaService) {}

  @Get('stats')
  stats() {
    return this.adminQuotaService.getStats();
  }

  @Get('logs')
  logs(@Query() query: QueryQuotaLogDto) {
    return this.adminQuotaService.findLogs(query);
  }

  @Get()
  getUserQuota(
    @Query('userId') userId: string,
    @Query('type') type?: QuotaType,
  ) {
    return this.adminQuotaService.getUserQuota(userId, type);
  }

  @Post('grant')
  async grant(@Body() dto: GrantQuotaDto) {
    await this.adminQuotaService.grant(dto);
    return { success: true };
  }

  @Post('deduct')
  async deduct(@Body() dto: GrantQuotaDto) {
    await this.adminQuotaService.deduct(dto);
    return { success: true };
  }
}
