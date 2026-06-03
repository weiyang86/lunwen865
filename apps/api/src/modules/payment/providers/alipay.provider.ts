import { BadRequestException, Injectable } from '@nestjs/common';
import * as AlipaySdkModule from 'alipay-sdk';
import { existsSync, readFileSync } from 'node:fs';
import { SettingsService } from '../../settings/settings.service';

type AlipayExecResult = string | Record<string, unknown>;

type AlipayClient = {
  exec: (
    method: string,
    params: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<AlipayExecResult>;
  pageExecute?: (
    method: string,
    httpMethodOrParams: string | Record<string, unknown>,
    bizParams?: Record<string, unknown>,
  ) => AlipayExecResult | Promise<AlipayExecResult>;
  checkNotifySign: (payload: Record<string, string>) => boolean;
};

type AlipayCtor = new (options: Record<string, unknown>) => AlipayClient;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function exportKeys(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value).sort() : [];
}

export function resolveAlipaySdkConstructor(mod: unknown): AlipayCtor {
  const topLevel = isRecord(mod) ? mod : {};
  const defaultExport = topLevel['default'];
  const defaultRecord = isRecord(defaultExport) ? defaultExport : {};
  const candidates = [
    topLevel['AlipaySdk'],
    defaultRecord['AlipaySdk'],
    defaultExport,
    mod,
  ];
  const ctor = candidates.find((candidate) => typeof candidate === 'function');
  if (typeof ctor !== 'function') {
    const keys = exportKeys(mod);
    const defaultKeys = exportKeys(defaultExport);
    const suffix = defaultKeys.length
      ? `; default keys: ${defaultKeys.join(',')}`
      : '';
    throw new BadRequestException(
      `支付宝 SDK 导出无效，无法初始化 AlipaySdk。exports keys: ${keys.join(',') || '(none)'}${suffix}`,
    );
  }
  return ctor as AlipayCtor;
}

type AlipaySettings = {
  appId: string;
  gateway: string;
  privateKeyPath: string;
  publicKeyPath: string;
  notifyUrl: string;
  returnUrl?: string;
  sellerId?: string;
  signType?: string;
  charset?: string;
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

export type AlipayQueryNormalizedResult = {
  channel: 'alipay';
  providerOrderNo: string;
  providerTradeNo: string;
  amount: number;
  paidAt: Date | null;
  tradeStatus: string;
  success: boolean;
  raw: Record<string, unknown>;
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

  private async getAlipaySettings(): Promise<AlipaySettings> {
    const cfg = await this.settings.getPaymentSettings();
    return cfg.alipay;
  }

  private assertConfigReady(a: AlipaySettings) {
    const missing = [
      ['ALIPAY_APP_ID', a.appId],
      ['ALIPAY_GATEWAY', a.gateway],
      ['ALIPAY_PRIVATE_KEY_PATH', a.privateKeyPath],
      ['ALIPAY_PUBLIC_KEY_PATH', a.publicKeyPath],
      ['ALIPAY_NOTIFY_URL', a.notifyUrl],
    ]
      .filter(([, value]) => !String(value ?? '').trim())
      .map(([key]) => key);
    if (missing.length) {
      throw new BadRequestException(
        `支付宝未配置完整，缺少: ${missing.join(', ')}`,
      );
    }
  }

  private async getClient(): Promise<AlipayClient> {
    const a = await this.getAlipaySettings();
    this.assertConfigReady(a);
    const key = [
      a.appId,
      a.gateway,
      a.privateKeyPath,
      a.publicKeyPath,
      a.signType ?? 'RSA2',
      a.charset ?? 'utf-8',
    ].join('|');
    if (this.client && this.clientKey === key) return this.client;

    const privateKey = this.loadKeyContent(a.privateKeyPath, '支付宝应用私钥');
    const publicKey = this.loadKeyContent(a.publicKeyPath, '支付宝公钥');

    const AlipaySdkCtor = resolveAlipaySdkConstructor(AlipaySdkModule);
    this.client = new AlipaySdkCtor({
      appId: a.appId,
      privateKey,
      alipayPublicKey: publicKey,
      gateway: a.gateway,
      signType: a.signType ?? 'RSA2',
      charset: a.charset ?? 'utf-8',
    });
    this.clientKey = key;
    return this.client;
  }

  private toScalarString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
      ? String(value)
      : fallback;
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

  private async createPageExecuteUrl(params: {
    method: 'alipay.trade.page.pay' | 'alipay.trade.wap.pay';
    outTradeNo: string;
    subject: string;
    totalAmountCents: number;
    notifyUrl: string;
    returnUrl?: string;
    productCode: 'FAST_INSTANT_TRADE_PAY' | 'QUICK_WAP_WAY';
  }) {
    const client = await this.getClient();
    const totalAmount = this.centsToYuan(params.totalAmountCents);
    const request = {
      notify_url: params.notifyUrl,
      return_url: params.returnUrl,
      bizContent: {
        out_trade_no: params.outTradeNo,
        product_code: params.productCode,
        total_amount: totalAmount,
        subject: params.subject || '论文通脑细胞套餐',
      },
    };
    const url = client.pageExecute
      ? await client.pageExecute(params.method, 'GET', request)
      : await client.exec(params.method, request, { method: 'GET' });
    return {
      paymentUrl: typeof url === 'string' ? url : JSON.stringify(url),
      rawRequest: request,
      rawResponse: url,
    };
  }

  pagePay(params: {
    outTradeNo: string;
    subject: string;
    totalAmountCents: number;
    notifyUrl: string;
    returnUrl?: string;
  }) {
    return this.createPageExecuteUrl({
      ...params,
      method: 'alipay.trade.page.pay',
      productCode: 'FAST_INSTANT_TRADE_PAY',
    });
  }

  wapPay(params: {
    outTradeNo: string;
    subject: string;
    totalAmountCents: number;
    notifyUrl: string;
    returnUrl?: string;
  }) {
    return this.createPageExecuteUrl({
      ...params,
      method: 'alipay.trade.wap.pay',
      productCode: 'QUICK_WAP_WAY',
    });
  }

  async verifyAndNormalizeNotify(
    payload: Record<string, string>,
  ): Promise<AlipayNotifyNormalizedResult> {
    const client = await this.getClient();
    if (!client.checkNotifySign(payload)) {
      throw new BadRequestException('支付宝异步通知验签失败');
    }

    const cfg = await this.getAlipaySettings();
    if (cfg.appId && payload['app_id'] && payload['app_id'] !== cfg.appId) {
      throw new BadRequestException('支付宝异步通知 app_id 不匹配');
    }
    if (
      cfg.sellerId &&
      payload['seller_id'] &&
      payload['seller_id'] !== cfg.sellerId
    ) {
      throw new BadRequestException('支付宝异步通知 seller_id 不匹配');
    }

    const tradeStatusRaw = String(payload['trade_status'] ?? 'UNKNOWN');
    const tradeStatus =
      tradeStatusRaw === 'TRADE_SUCCESS' || tradeStatusRaw === 'TRADE_FINISHED'
        ? tradeStatusRaw
        : tradeStatusRaw
          ? 'FAILED'
          : 'UNKNOWN';
    const providerOrderNo = String(payload['out_trade_no'] ?? '');
    const providerTradeNo = String(payload['trade_no'] ?? '');
    if (!providerOrderNo) throw new BadRequestException('缺少 out_trade_no');
    if (!providerTradeNo) throw new BadRequestException('缺少 trade_no');

    return {
      channel: 'alipay',
      providerOrderNo,
      providerTradeNo,
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

  async queryPayment(outTradeNo: string): Promise<AlipayQueryNormalizedResult> {
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
        : response;
    const tradeStatus = this.toScalarString(data['trade_status'], 'UNKNOWN');
    const success =
      tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED';
    return {
      channel: 'alipay',
      providerOrderNo: this.toScalarString(data['out_trade_no'], outTradeNo),
      providerTradeNo: this.toScalarString(data['trade_no']),
      amount: this.yuanToCents(this.toScalarString(data['total_amount'], '0')),
      paidAt: this.toScalarString(data['send_pay_date'])
        ? new Date(this.toScalarString(data['send_pay_date']))
        : null,
      tradeStatus,
      success,
      raw: response,
    };
  }

  async query(outTradeNo: string): Promise<{
    status: 'PENDING' | 'PAID';
    transactionId?: string;
    paidAmountCents?: number;
    paidAt?: Date;
  }> {
    const normalized = await this.queryPayment(outTradeNo);
    if (normalized.success) {
      return {
        status: 'PAID',
        transactionId: normalized.providerTradeNo,
        paidAmountCents: normalized.amount,
        paidAt: normalized.paidAt ?? undefined,
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
        : response;
    const tradeNo = data['trade_no'];
    return { refundId: typeof tradeNo === 'string' ? tradeNo : undefined };
  }
}
