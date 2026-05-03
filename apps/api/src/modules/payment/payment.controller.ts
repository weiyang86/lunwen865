import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentChannel, PaymentMethod } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrepayDto } from './dto/prepay.dto';
import { PaymentService } from './payment.service';

@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly config: ConfigService,
  ) {}

  @Post('prepay')
  prepay(
    @CurrentUser('id') uid: string,
    @Body() dto: PrepayDto,
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? '0.0.0.0';
    return this.paymentService.prepay(uid, dto, ip);
  }

  @Post('sandbox/simulate-paid')
  simulatePaid(
    @CurrentUser('id') uid: string,
    @Body('orderId') orderId: string,
  ) {
    if (this.config.get<boolean>('payment.sandbox') !== true) {
      throw new ForbiddenException('该接口仅在沙箱模式可用');
    }
    return this.paymentService.simulatePaid(uid, orderId, {
      channel: PaymentChannel.WECHAT,
      method: PaymentMethod.WECHAT_NATIVE,
    });
  }
}
