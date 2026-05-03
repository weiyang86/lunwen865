import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { QuotaModule } from '../quota/quota.module';
import { OrderCleanupService } from './order.cleanup';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [PrismaModule, QuotaModule, ScheduleModule.forRoot()],
  controllers: [OrderController],
  providers: [OrderService, OrderCleanupService],
  exports: [OrderService],
})
export class OrderModule {}
