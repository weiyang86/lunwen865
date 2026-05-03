import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { NotifyResultDto } from './dto/notify-result.dto';
import { PaymentService } from './payment.service';

@Controller('payment/notify')
@Public()
export class NotifyController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('wechat')
  async wechatPayNotify(
    @Req() req: Request,
    @Body() body: unknown,
  ): Promise<NotifyResultDto> {
    const rawBody =
      (req as unknown as { rawBody?: Buffer }).rawBody?.toString('utf8') ??
      JSON.stringify(body);
    const headers = Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.join(',') : String(v),
      ]),
    );

    try {
      await this.paymentService.handleWechatPayNotify({
        headers,
        rawBody,
        body,
      });
      return { code: 'SUCCESS' };
    } catch (error: unknown) {
      return {
        code: 'FAIL',
        message: error instanceof Error ? error.message : '处理失败',
      };
    }
  }

  @Post('alipay')
  async alipayPayNotify(
    @Body() body: Record<string, string>,
  ): Promise<NotifyResultDto> {
    try {
      await this.paymentService.handleAlipayPayNotify(body);
      return { code: 'SUCCESS' };
    } catch (error: unknown) {
      return {
        code: 'FAIL',
        message: error instanceof Error ? error.message : '处理失败',
      };
    }
  }

  @Post('wechat/refund')
  async wechatRefundNotify(
    @Req() req: Request,
    @Body() body: unknown,
  ): Promise<NotifyResultDto> {
    const rawBody =
      (req as unknown as { rawBody?: Buffer }).rawBody?.toString('utf8') ??
      JSON.stringify(body);
    const headers = Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.join(',') : String(v),
      ]),
    );

    try {
      await this.paymentService.handleWechatRefundNotify({
        headers,
        rawBody,
        body,
      });
      return { code: 'SUCCESS' };
    } catch (error: unknown) {
      return {
        code: 'FAIL',
        message: error instanceof Error ? error.message : '处理失败',
      };
    }
  }

  @Post('alipay/refund')
  async alipayRefundNotify(
    @Body() body: Record<string, string>,
  ): Promise<NotifyResultDto> {
    try {
      await this.paymentService.handleAlipayRefundNotify(body);
      return { code: 'SUCCESS' };
    } catch (error: unknown) {
      return {
        code: 'FAIL',
        message: error instanceof Error ? error.message : '处理失败',
      };
    }
  }
}
