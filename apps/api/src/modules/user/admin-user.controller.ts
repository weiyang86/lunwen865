import {
  Body,
  Controller,
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
import { AdminUserService } from './admin-user.service';
import {
  AdminUpdateUserDto,
  BanUserDto,
  GrantQuotaDto,
  QueryUsersDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from './dto/admin-update-user.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  list(@Query() query: QueryUsersDto) {
    return this.adminUserService.findAll(query);
  }

  @Get('stats/overview')
  stats() {
    return this.adminUserService.getStats();
  }

  @Get('stats')
  statsAlias() {
    return this.adminUserService.getStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminUserService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    if (dto.status === 'BANNED') {
      return this.adminUserService.ban(id, {
        reason: dto.reason ?? 'BANNED',
        days: dto.days,
      });
    }
    if (dto.status === 'ACTIVE') {
      return this.adminUserService.unban(id);
    }
    return this.adminUserService.update(id, { status: dto.status });
  }

  @Patch(':id/role')
  @Roles(UserRole.SUPER_ADMIN)
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.adminUserService.update(id, { role: dto.role });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.adminUserService.update(id, dto);
  }

  @Post(':id/ban')
  ban(@Param('id') id: string, @Body() dto: BanUserDto) {
    return this.adminUserService.ban(id, dto);
  }

  @Post(':id/unban')
  unban(@Param('id') id: string) {
    return this.adminUserService.unban(id);
  }

  @Post(':id/grant-quota')
  grantQuota(@Param('id') id: string, @Body() dto: GrantQuotaDto) {
    return this.adminUserService.grantQuota(id, dto);
  }

  @Post(':id/reset-password')
  @Roles(UserRole.SUPER_ADMIN)
  resetPassword(@Param('id') id: string) {
    return this.adminUserService.resetPassword(id);
  }
}
