import { BadRequestException, Injectable } from '@nestjs/common';
import AlipaySdk from 'alipay-sdk';
import { existsSync, readFileSync } from 'node:fs';
import { SettingsService } from '../../settings/settings.service';

type AlipayExecResult = string | Record<string, unknown>;

type AlipayClient = {
  exec: (
    method: string,
    params: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<AlipayExecResult>;
  checkNotifySign: (payload: Record<string, string>) => boolean;
};

export type AlipayNotifyNormalizedResult = {
  channel: 'alipay';
  providerOrderNo: string;
  providerTradeNo: string;
  amount: number;
  paidAt: Date | null;
  tradeStatus: 'TRADE_SUCCESS' | 'TRADE_FINISHED' | 'FAILED' | 'UNKNOWN';
  success: boolean;
  raw: Record<string, string>;
};

@Injectable()
export class AlipayProvider {
  private client: AlipayClient | null = null;
  private clientKey: string | null = null;

  constructor(private readonly settings: SettingsService) {}

  private centsToYuan(cents: number): string {
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(cents);
    const yuan = Math.floor(abs / 100);
    const fen = abs % 100;
    return `${sign}${yuan}.${String(fen).padStart(2, '0')}`;
  }

  private yuanToCents(amount: string): number {
    const raw = String(amount ?? '').trim();
    if (!raw) return 0;
    const neg = raw.startsWith('-');
    const s = neg ? raw.slice(1) : raw;
    const [yuanRaw, fenRaw = ''] = s.split('.');
    const yuan = Number.parseInt(yuanRaw || '0', 10);
    if (!Number.isFinite(yuan)) return 0;
    const fen2 = (fenRaw + '00').slice(0, 2);
    const fen = Number.parseInt(fen2 || '0', 10);
    if (!Number.isFinite(fen)) return 0;
    const cents = yuan * 100 + fen;
    return neg ? -cents : cents;
  }

  private async isSandbox(): Promise<boolean> {
    const cfg = await this.settings.getPaymentSettings();
    return cfg.sandbox === true;
  }

  private async assertConfigReady() {
    const cfg = await this.settings.getPaymentSettings();
    const a = cfg.alipay as Record<string, string>;
    if (
      !a.appId ||
      !a.privateKeyPath ||
      !a.publicKeyPath ||
      !a.gateway ||
      !a.notifyUrl
    ) {
      throw new BadRequestException('支付宝未配置完整，请检查环境变量');
    }
  }

  private async getClient(): Promise<AlipayClient> {
    await this.assertConfigReady();
    const cfg = await this.settings.getPaymentSettings();
    const a = cfg.alipay as Record<string, string>;
    const key = [a.appId, a.gateway, 'alipay'].join('|');
    if (this.client && this.clientKey === key) return this.client;

    const privateKey = this.loadKeyContent(a.privateKeyPath, '支付宝应用私钥');
    const publicKey = this.loadKeyContent(a.publicKeyPath, '支付宝公钥');

    const AlipayCtor = AlipaySdk as unknown as new (
      options: Record<string, unknown>,
    ) => AlipayClient;
    this.client = new AlipayCtor({
      appId: a.appId,
      privateKey,
      alipayPublicKey: publicKey,
      gateway: a.gateway,
    });
    this.clientKey = key;
    return this.client;
  }

  private loadKeyContent(value: string, label: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      throw new BadRequestException(`${label}未配置`);
    }
    if (raw.includes('BEGIN') && raw.includes('KEY')) {
      return raw;
    }
    if (!existsSync(raw)) {
      throw new BadRequestException(`${label}文件不可读: ${raw}`);
    }
    return readFileSync(raw, 'utf8');
  }

  async pagePay(params: {
    outTradeNo: string;
    subject: string;
    totalAmountCents: number;
    notifyUrl: string;
    returnUrl?: string;
  }) {
    if (await this.isSandbox()) {
      const url = `https://openapi.alipay.com/gateway.do/mock-page-pay?out_trade_no=${params.outTradeNo}`;
      return { paymentUrl: url, rawResponse: { paymentUrl: url } };
    }
    const client = await this.getClient();
    const totalAmount = this.centsToYuan(params.totalAmountCents);
    const url = await client.exec(
      'alipay.trade.page.pay',
      {
        notify_url: params.notifyUrl,
        return_url: params.returnUrl,
        bizContent: {
          out_trade_no: params.outTradeNo,
          product_code: 'FAST_INSTANT_TRADE_PAY',
          total_amount: totalAmount,
          subject: params.subject,
        },
      },
      { method: 'GET' },
    );
    return {
      paymentUrl: typeof url === 'string' ? url : JSON.stringify(url),
      rawResponse: url,
    };
  }

  async wapPay(params: {
    outTradeNo: string;
    subject: string;
    totalAmountCents: number;
    notifyUrl: string;
    returnUrl?: string;
  }) {
    if (await this.isSandbox()) {
      const url = `https://openapi.alipay.com/gateway.do/mock-wap-pay?out_trade_no=${params.outTradeNo}`;
      return { paymentUrl: url, rawResponse: { paymentUrl: url } };
    }
    const client = await this.getClient();
    const totalAmount = this.centsToYuan(params.totalAmountCents);
    const url = await client.exec(
      'alipay.trade.wap.pay',
      {
        notify_url: params.notifyUrl,
        return_url: params.returnUrl,
        bizContent: {
          out_trade_no: params.outTradeNo,
          product_code: 'QUICK_WAP_WAY',
          total_amount: totalAmount,
          subject: params.subject,
        },
      },
      { method: 'GET' },
    );
    return {
      paymentUrl: typeof url === 'string' ? url : JSON.stringify(url),
      rawResponse: url,
    };
  }

  async verifyAndNormalizeNotify(
    payload: Record<string, string>,
  ): Promise<AlipayNotifyNormalizedResult> {
    const client = await this.getClient();
    if (!client.checkNotifySign(payload)) {
      throw new BadRequestException('支付宝异步通知验签失败');
    }
    const tradeStatusRaw = String(payload['trade_status'] ?? 'UNKNOWN');
    const tradeStatus =
      tradeStatusRaw === 'TRADE_SUCCESS' || tradeStatusRaw === 'TRADE_FINISHED'
        ? tradeStatusRaw
        : tradeStatusRaw
          ? 'FAILED'
          : 'UNKNOWN';
    return {
      channel: 'alipay',
      providerOrderNo: String(payload['out_trade_no'] ?? ''),
      providerTradeNo: String(payload['trade_no'] ?? ''),
      amount: this.yuanToCents(String(payload['total_amount'] ?? '0')),
      paidAt: payload['gmt_payment'] ? new Date(payload['gmt_payment']) : null,
      tradeStatus,
      success:
        tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED',
      raw: payload,
    };
  }

  async verifyAndParsePayNotify(payload: Record<string, string>) {
    const normalized = await this.verifyAndNormalizeNotify(payload);
    return {
      outTradeNo: normalized.providerOrderNo,
      tradeNo: normalized.providerTradeNo,
      paidAmountCents: normalized.amount,
      paidAt: normalized.paidAt ?? new Date(),
    };
  }

  refund(params: {
    outTradeNo: string;
    outRefundNo: string;
    refundAmountCents: number;
    reason: string;
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
    const client = await this.getClient();
    const rsp = await client.exec('alipay.trade.query', {
      bizContent: { out_trade_no: outTradeNo },
    });
    const response =
      typeof rsp === 'string' ? ({ raw: rsp } as Record<string, unknown>) : rsp;
    const root = response['alipay_trade_query_response'];
    const data =
      root && typeof root === 'object'
        ? (root as Record<string, unknown>)
        : (response as Record<string, unknown>);
    const status = String(data['trade_status'] ?? '');
    if (status === 'TRADE_SUCCESS' || status === 'TRADE_FINISHED') {
      return {
        status: 'PAID',
        transactionId: String(data['trade_no'] ?? ''),
        paidAmountCents: this.yuanToCents(String(data['total_amount'] ?? '0')),
        paidAt: data['send_pay_date']
          ? new Date(String(data['send_pay_date']))
          : undefined,
      };
    }
    return { status: 'PENDING' as const };
  }

  private async applyRefund(params: {
    outTradeNo: string;
    outRefundNo: string;
    refundAmountCents: number;
    reason: string;
  }): Promise<{ refundId?: string }> {
    if (await this.isSandbox()) {
      return { refundId: `ALI_REFUND_${params.outRefundNo}` };
    }
    const client = await this.getClient();
    const rsp = await client.exec('alipay.trade.refund', {
      bizContent: {
        out_trade_no: params.outTradeNo,
        refund_amount: this.centsToYuan(params.refundAmountCents),
        out_request_no: params.outRefundNo,
        refund_reason: params.reason,
      },
    });
    const response =
      typeof rsp === 'string' ? ({ raw: rsp } as Record<string, unknown>) : rsp;
    const root = response['alipay_trade_refund_response'];
    const data =
      root && typeof root === 'object'
        ? (root as Record<string, unknown>)
        : (response as Record<string, unknown>);
    const tradeNo = data['trade_no'];
    return { refundId: typeof tradeNo === 'string' ? tradeNo : undefined };
  }
}
