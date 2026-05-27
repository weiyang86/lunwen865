import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import WxPay from 'wechatpay-node-v3';
import { SettingsService } from '../../settings/settings.service';

type WechatNativePrepayResult = { codeUrl: string; rawResponse: unknown };
type WechatH5PrepayResult = { mwebUrl: string; rawResponse: unknown };

export type WechatNotifyNormalizedResult = {
  channel: 'wechat';
  providerOrderNo: string;
  providerTradeNo: string;
  amount: number;
  paidAt: Date | null;
  tradeStatus: 'SUCCESS' | 'FAILED' | 'UNKNOWN';
  success: boolean;
  raw: Record<string, unknown>;
};

type WxPayTransactionsResponse = {
  code_url?: string;
  codeUrl?: string;
  mweb_url?: string;
  mwebUrl?: string;
};

type WxPayDecipheredResource = {
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  amount?: { total?: number };
  success_time?: string;
};

type WxPayClient = {
  transactions_native: (params: {
    description: string;
    out_trade_no: string;
    notify_url: string;
    amount: { total: number };
    scene_info: { payer_client_ip: string };
  }) => Promise<WxPayTransactionsResponse>;
  transactions_h5: (params: {
    description: string;
    out_trade_no: string;
    notify_url: string;
    amount: { total: number };
    scene_info: { payer_client_ip: string; h5_info: { type: 'Wap' } };
  }) => Promise<WxPayTransactionsResponse>;
  verifySign: (headers: Record<string, string>, body: string) => boolean;
  decipher_gcm: (resource: unknown) => WxPayDecipheredResource;
  [key: string]: unknown;
};

@Injectable()
export class WechatPayProvider {
  private readonly logger = new Logger(WechatPayProvider.name);
  private client: WxPayClient | null = null;
  private clientKey: string | null = null;

  constructor(private readonly settings: SettingsService) {}

  private async isSandbox(): Promise<boolean> {
    const mode = String(process.env.PAYMENT_MODE ?? '').trim().toLowerCase();
    if (mode === 'production') return false;
    if (mode === 'mock') return true;
    const cfg = await this.settings.getPaymentSettings();
    return cfg.sandbox === true;
  }

  private async assertWechatConfigReady() {
    const cfg = await this.settings.getPaymentSettings();
    const w = cfg.wechat;
    if (
      !w.appid ||
      !w.mchid ||
      !w.serialNo ||
      !w.apiV3Key ||
      !w.notifyUrl ||
      !w.privateKeyPath
    ) {
      this.logger.error(
        '[wechat] 配置不完整，拒绝下单（production 不允许降级 mock）',
      );
      throw new BadRequestException('微信支付未配置完整，请检查环境变量');
    }
  }

  private loadSecretContent(raw: string, label: string): string {
    const value = String(raw ?? '').trim();
    if (!value) {
      throw new BadRequestException(`微信支付配置缺失：${label}`);
    }
    if (value.includes('-----BEGIN')) {
      return value;
    }
    try {
      return readFileSync(value, 'utf8');
    } catch {
      throw new BadRequestException(`微信支付密钥文件不可读：${label}`);
    }
  }

  private async getClient(): Promise<WxPayClient> {
    await this.assertWechatConfigReady();
    const cfg = await this.settings.getPaymentSettings();
    const w = cfg.wechat;
    const key = [w.appid, w.mchid, w.serialNo, w.privateKeyPath, 'wechat'].join(
      '|',
    );
    if (this.client && this.clientKey === key) return this.client;

    const privateKey = this.loadSecretContent(
      w.privateKeyPath,
      'privateKeyPath',
    );
    const WxPayCtor = WxPay as unknown as new (
      options: Record<string, unknown>,
    ) => WxPayClient;
    this.client = new WxPayCtor({
      appid: w.appid,
      mchid: w.mchid,
      serial_no: w.serialNo,
      privateKey,
      key: w.apiV3Key,
    });
    this.clientKey = key;
    return this.client;
  }

  async nativePrepay(params: {
    outTradeNo: string;
    description: string;
    amountCents: number;
    clientIp: string;
    notifyUrl: string;
  }): Promise<WechatNativePrepayResult> {
    if (await this.isSandbox()) {
      this.logger.warn('[wechat] nativePrepay 使用 mock 模式返回二维码');
      const raw = {
        code_url: `weixin://wxpay/mock?out_trade_no=${params.outTradeNo}`,
      };
      return { codeUrl: String(raw.code_url), rawResponse: raw };
    }
    this.logger.log('[wechat] nativePrepay 发起真实下单请求');
    try {
      const client = await this.getClient();
      const result = await client.transactions_native({
        description: params.description,
        out_trade_no: params.outTradeNo,
        notify_url: params.notifyUrl,
        amount: { total: params.amountCents },
        scene_info: { payer_client_ip: params.clientIp },
      });
      const codeUrl = result.code_url ?? result.codeUrl;
      if (!codeUrl) {
        throw new BadRequestException('微信 Native 下单失败：未返回 code_url');
      }
      if (String(codeUrl).includes('wxpay/mock')) {
        throw new BadRequestException('微信 Native 下单失败：返回了 mock 二维码');
      }
      this.logger.log('[wechat] nativePrepay 真实下单成功');
      return { codeUrl: String(codeUrl), rawResponse: result };
    } catch (error) {
      this.logger.error(
        `[wechat] nativePrepay 调用失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        `微信 Native 下单失败：${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }

  async h5Prepay(params: {
    outTradeNo: string;
    description: string;
    amountCents: number;
    clientIp: string;
    notifyUrl: string;
  }): Promise<WechatH5PrepayResult> {
    if (await this.isSandbox()) {
      const raw = {
        mweb_url: `https://wx.tenpay.com/mock-h5-pay?out_trade_no=${params.outTradeNo}`,
      };
      return { mwebUrl: String(raw.mweb_url), rawResponse: raw };
    }
    const client = await this.getClient();
    const result = await client.transactions_h5({
      description: params.description,
      out_trade_no: params.outTradeNo,
      notify_url: params.notifyUrl,
      amount: { total: params.amountCents },
      scene_info: {
        payer_client_ip: params.clientIp,
        h5_info: { type: 'Wap' },
      },
    });
    const mwebUrl = result.mweb_url ?? result.mwebUrl;
    if (!mwebUrl)
      throw new BadRequestException('微信 H5 下单失败：未返回 mweb_url');
    return { mwebUrl: String(mwebUrl), rawResponse: result };
  }

  async verifyAndNormalizePayNotify(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<WechatNotifyNormalizedResult> {
    const client = await this.getClient();
    const verified = client.verifySign(headers, rawBody);
    if (!verified) throw new BadRequestException('微信回调验签失败');
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const resource = client.decipher_gcm(body['resource']);
    const tradeState = String(resource.trade_state ?? 'UNKNOWN');
    const paidAt = resource.success_time
      ? new Date(resource.success_time)
      : null;
    return {
      channel: 'wechat',
      providerOrderNo: String(resource.out_trade_no ?? ''),
      providerTradeNo: String(resource.transaction_id ?? ''),
      amount: Number(resource.amount?.total ?? 0),
      paidAt,
      tradeStatus:
        tradeState === 'SUCCESS'
          ? 'SUCCESS'
          : tradeState
            ? 'FAILED'
            : 'UNKNOWN',
      success: tradeState === 'SUCCESS',
      raw: body,
    };
  }
  async verifyAndParsePayNotify(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<{
    outTradeNo: string;
    transactionId: string;
    paidAmountCents: number;
    paidAt: Date;
  }> {
    const normalized = await this.verifyAndNormalizePayNotify(headers, rawBody);
    return {
      outTradeNo: normalized.providerOrderNo,
      transactionId: normalized.providerTradeNo,
      paidAmountCents: normalized.amount,
      paidAt: normalized.paidAt ?? new Date(),
    };
  }

  refund(params: {
    outTradeNo: string;
    transactionId?: string;
    outRefundNo: string;
    reason: string;
    refundAmountCents: number;
    totalAmountCents: number;
    notifyUrl: string;
  }): Promise<{ refundId?: string }> {
    return this.applyRefund(params);
  }

  query(outTradeNo: string): Promise<{
    status: 'PENDING' | 'PAID';
    transactionId?: string;
    paidAmountCents?: number;
    paidAt?: Date;
  }> {
    return this.queryTrade(outTradeNo);
  }

  private async queryTrade(outTradeNo: string): Promise<{
    status: 'PENDING' | 'PAID';
    transactionId?: string;
    paidAmountCents?: number;
    paidAt?: Date;
  }> {
    if (await this.isSandbox()) {
      return { status: 'PENDING' as const };
    }
    const client = (await this.getClient()) as unknown as Record<string, unknown>;
    const fn =
      client['queryTransactionByOutTradeNo'] ??
      client['transactions_out_trade_no'] ??
      client['transactionQueryByOutTradeNo'];
    if (typeof fn !== 'function') {
      return { status: 'PENDING' as const };
    }
    const rsp = await (
      fn as (params: Record<string, unknown>) => Promise<Record<string, unknown>>
    )({ out_trade_no: outTradeNo });
    const tradeState = String(rsp['trade_state'] ?? '');
    if (tradeState === 'SUCCESS') {
      const amountRaw =
        rsp['amount'] && typeof rsp['amount'] === 'object'
          ? (rsp['amount'] as Record<string, unknown>)['total']
          : undefined;
      return {
        status: 'PAID',
        transactionId: String(rsp['transaction_id'] ?? ''),
        paidAmountCents: Number(amountRaw ?? 0),
        paidAt: rsp['success_time']
          ? new Date(String(rsp['success_time']))
          : undefined,
      };
    }
    return { status: 'PENDING' as const };
  }

  private async applyRefund(params: {
    outTradeNo: string;
    transactionId?: string;
    outRefundNo: string;
    reason: string;
    refundAmountCents: number;
    totalAmountCents: number;
    notifyUrl: string;
  }): Promise<{ refundId?: string }> {
    if (await this.isSandbox()) {
      return { refundId: `WX_REFUND_${params.outRefundNo}` };
    }
    const client = (await this.getClient()) as unknown as Record<string, unknown>;
    const fn =
      client['refund'] ??
      client['refunds'] ??
      client['transactions_refunds'] ??
      client['refundByOutTradeNo'];
    if (typeof fn !== 'function') {
      throw new BadRequestException('微信退款能力不可用：SDK 未暴露退款方法');
    }
    const payload: Record<string, unknown> = {
      out_trade_no: params.outTradeNo,
      out_refund_no: params.outRefundNo,
      reason: params.reason,
      notify_url: params.notifyUrl,
      amount: {
        refund: params.refundAmountCents,
        total: params.totalAmountCents,
        currency: 'CNY',
      },
    };
    if (params.transactionId) {
      payload['transaction_id'] = params.transactionId;
    }
    const rsp = await (
      fn as (p: Record<string, unknown>) => Promise<Record<string, unknown>>
    )(payload);
    const refundId = rsp['refund_id'];
    return { refundId: typeof refundId === 'string' ? refundId : undefined };
  }
}
