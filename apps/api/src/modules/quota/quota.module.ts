import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminQuotaController } from './admin-quota.controller';
import { AdminQuotaService } from './admin-quota.service';
import { QuotaController } from './quota.controller';
import { QuotaService } from './quota.service';

@Module({
  imports: [PrismaModule],
  controllers: [QuotaController, AdminQuotaController],
  providers: [QuotaService, AdminQuotaService],
  exports: [QuotaService],
})
export class QuotaModule {}
