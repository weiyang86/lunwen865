import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { QuotaModule } from '../quota/quota.module';
import { AgencyOrderController } from './agency-order.controller';
import { AgencyOrderService } from './agency-order.service';
import { OrderCleanupService } from './order.cleanup';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [PrismaModule, QuotaModule, ScheduleModule.forRoot()],
  controllers: [OrderController, AgencyOrderController],
  providers: [OrderService, AgencyOrderService, OrderCleanupService],
  exports: [OrderService],
})
export class OrderModule {}
