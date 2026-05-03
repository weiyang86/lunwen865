import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentChannel, PaymentMethod, UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderService } from './order.service';
import { AdminOrderService } from './admin-order.service';
import { QueryAdminOrderDto } from './dto/query-admin-order.dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminOrderController {
  constructor(
    private readonly adminOrderService: AdminOrderService,
    private readonly orderService: OrderService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(@Query() q: QueryAdminOrderDto) {
    return this.adminOrderService.findAll(q);
  }

  @Get('stats')
  stats() {
    return this.adminOrderService.getStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminOrderService.findOne(id);
  }

  @Post(':id/close')
  close(@Param('id') id: string) {
    return this.adminOrderService.close(id);
  }

  @Post(':id/test-mark-paid')
  async testMarkPaid(@Param('id') id: string) {
    if (this.config.get<boolean>('payment.sandbox') !== true) {
      throw new ForbiddenException('该接口仅在沙箱模式可用');
    }

    const o = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, amountCents: true },
    });
    if (!o) {
      return this.orderService.markPaid({
        orderId: id,
        transactionId: `TEST_${Date.now()}`,
        paidAmountCents: 0,
        method: PaymentMethod.WECHAT_NATIVE,
        channel: PaymentChannel.WECHAT,
        paidAt: new Date(),
      });
    }

    return this.orderService.markPaid({
      orderId: id,
      transactionId: `TEST_${Date.now()}`,
      paidAmountCents: o.amountCents,
      method: PaymentMethod.WECHAT_NATIVE,
      channel: PaymentChannel.WECHAT,
      paidAt: new Date(),
    });
  }
}
