import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SettingsService } from '../../settings/settings.service';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async getAll() {
    const [payment, site] = await Promise.all([
      this.settings.getPaymentSettingsForAdmin(),
      this.settings.getSiteSettings(),
    ]);
    return { payment, site };
  }

  @Put('payment')
  updatePayment(@Body() dto: UpdatePaymentSettingsDto) {
    return this.settings.updatePaymentSettings(dto);
  }

  @Put('site')
  updateSite(@Body() dto: UpdateSiteSettingsDto) {
    return this.settings.updateSiteSettings(dto);
  }
}
