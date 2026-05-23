import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { PaymentChannel, PaymentMethod } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PrepayDto } from './dto/prepay.dto';
import { PaymentService } from './payment.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('payments/create')
  createPayment(
    @CurrentUser('id') uid: string,
    @Body() dto: CreatePaymentDto,
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? '0.0.0.0';
    return this.paymentService.createPayment(uid, dto, ip);
  }

  @Post('payments/mock/success')
  mockSuccess(
    @CurrentUser('id') uid: string,
    @Body('orderId') orderId: string,
  ) {
    return this.paymentService.mockSettle(uid, orderId, 'success');
  }

  @Post('payments/mock/fail')
  mockFail(@CurrentUser('id') uid: string, @Body('orderId') orderId: string) {
    return this.paymentService.mockSettle(uid, orderId, 'fail');
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
  simulatePaid(
    @CurrentUser('id') uid: string,
    @Body('orderId') orderId: string,
  ) {
    return this.paymentService.simulatePaid(uid, orderId, {
      channel: PaymentChannel.WECHAT,
      method: PaymentMethod.WECHAT_NATIVE,
    });
  }
}
