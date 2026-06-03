import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentChannel, PaymentMethod, UserRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PrepayDto } from './dto/prepay.dto';
import { PaymentService } from './payment.service';
import { ReconcileService } from './reconcile.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly reconcileService: ReconcileService,
  ) {}

  @Post('payments/create')
  createPayment(
    @CurrentUser('id') uid: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: CreatePaymentDto,
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? '0.0.0.0';
    return this.paymentService.createPayment({ id: uid, role }, dto, ip);
  }

  @Post('payments/mock/success')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  mockSuccess(
    @CurrentUser('id') uid: string,
    @CurrentUser('role') role: UserRole,
    @Body('orderId') orderId: string,
  ) {
    return this.paymentService.mockSettle(
      { id: uid, role },
      orderId,
      'success',
    );
  }

  @Post('payments/mock/fail')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  mockFail(
    @CurrentUser('id') uid: string,
    @CurrentUser('role') role: UserRole,
    @Body('orderId') orderId: string,
  ) {
    return this.paymentService.mockSettle({ id: uid, role }, orderId, 'fail');
  }

  @Post('payment/prepay')
  prepay(
    @CurrentUser('id') uid: string,
    @Body() dto: PrepayDto,
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? '0.0.0.0';
    return this.paymentService.prepay(uid, dto, ip);
  }

  @Post('payment/sandbox/simulate-paid')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  simulatePaid(
    @CurrentUser('id') uid: string,
    @CurrentUser('role') role: UserRole,
    @Body('orderId') orderId: string,
  ) {
    return this.paymentService.simulatePaid({ id: uid, role }, orderId, {
      channel: PaymentChannel.WECHAT,
      method: PaymentMethod.WECHAT_NATIVE,
    });
  }

  @Get('orders/:orderId/payment-status')
  getOrderPaymentStatusAlias(
    @CurrentUser('id') uid: string,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentService.getOrderPaymentStatus(uid, orderId);
  }

  @Post('orders/:orderId/payment-status/refresh')
  async refreshOrderPaymentStatusAlias(
    @CurrentUser('id') uid: string,
    @Param('orderId') orderId: string,
  ) {
    await this.paymentService.getOrderPaymentStatus(uid, orderId);
    await this.reconcileService.queryAndSettleByOrderId(orderId);
    return this.paymentService.getOrderPaymentStatus(uid, orderId);
  }

  @Post('payment/orders/:orderId/status/refresh')
  async refreshOrderPaymentStatus(
    @CurrentUser('id') uid: string,
    @Param('orderId') orderId: string,
  ) {
    await this.paymentService.getOrderPaymentStatus(uid, orderId);
    await this.reconcileService.queryAndSettleByOrderId(orderId);
    return this.paymentService.getOrderPaymentStatus(uid, orderId);
  }

  @Get('payment/orders/:orderId/status')
  getOrderPaymentStatus(
    @CurrentUser('id') uid: string,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentService.getOrderPaymentStatus(uid, orderId);
  }
}
