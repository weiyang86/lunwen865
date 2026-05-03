import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { BindEmailDto, BindPhoneDto } from './dto/bind.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async me(@CurrentUser('id') userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) return null;
    return this.userService.toSafeUser(user);
  }

  @Patch('me')
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(userId, dto);
  }

  @Post('me/bind-phone')
  bindPhone(@CurrentUser('id') userId: string, @Body() dto: BindPhoneDto) {
    return this.userService.bindPhone(userId, dto.phone, dto.code);
  }

  @Post('me/bind-email')
  bindEmail(@CurrentUser('id') userId: string, @Body() dto: BindEmailDto) {
    return this.userService.bindEmail(userId, dto.email, dto.code);
  }

  @Get('me/login-logs')
  loginLogs(@CurrentUser('id') userId: string, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : undefined;
    const safeLimit =
      parsed && Number.isFinite(parsed)
        ? Math.min(Math.max(parsed, 1), 100)
        : 20;
    return this.userService.findMyLoginLogs(userId, safeLimit);
  }

  @Get('me/quota')
  quota(@CurrentUser('id') userId: string) {
    return this.userService.getMyQuota(userId);
  }
}
