import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'node:fs';
import AlipaySdk from 'alipay-sdk';

type AlipayPrepayResult = { paymentUrl: string };

type AlipayPayNotifyResult = {
  outTradeNo: string;
  tradeNo: string;
  paidAmountCents: number;
  paidAt: Date;
};

type AlipayRefundResult = { outRefundNo: string; refundId?: string };
type AlipayQueryResult = {
  status: 'PENDING' | 'PAID';
  transactionId?: string;
  paidAmountCents?: number;
  paidAt?: Date;
};

type AlipayExecResult = string | Record<string, unknown>;

type AlipayClient = {
  exec: (
    method: string,
    params: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<AlipayExecResult>;
  checkNotifySign: (payload: Record<string, string>) => boolean;
};

@Injectable()
export class AlipayProvider {
  private client: AlipayClient | null = null;

  constructor(private readonly config: ConfigService) {}

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

  getChannel(): 'ALIPAY' {
    return 'ALIPAY';
  }

  isSandbox(): boolean {
    return this.config.get<boolean>('payment.sandbox', true) === true;
  }

  private getClient(): AlipayClient {
    if (this.client) return this.client;

    const appId = this.config.get<string>('payment.alipay.appId', '');
    const privateKeyPath = this.config.get<string>(
      'payment.alipay.privateKeyPath',
      '',
    );
    const publicKeyPath = this.config.get<string>(
      'payment.alipay.publicKeyPath',
      '',
    );
    const gateway = this.config.get<string>('payment.alipay.gateway', '');

    const privateKey = privateKeyPath
      ? fs.readFileSync(privateKeyPath, 'utf8')
      : '';
    const alipayPublicKey = publicKeyPath
      ? fs.readFileSync(publicKeyPath, 'utf8')
      : '';

    const AlipayCtor = AlipaySdk as unknown as new (
      options: Record<string, unknown>,
    ) => AlipayClient;
    this.client = new AlipayCtor({
      appId,
      privateKey,
      alipayPublicKey,
      gateway,
    });
    return this.client;
  }

  async pagePay(params: {
    outTradeNo: string;
    subject: string;
    totalAmountCents: number;
    notifyUrl: string;
    returnUrl?: string;
  }): Promise<AlipayPrepayResult> {
    if (this.isSandbox()) {
      return {
        paymentUrl: `https://openapi.alipay.com/gateway.do/mockpay?out_trade_no=${params.outTradeNo}`,
      };
    }

    const client = this.getClient();
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

    return { paymentUrl: typeof url === 'string' ? url : JSON.stringify(url) };
  }

  verifyAndParsePayNotify(
    payload: Record<string, string>,
  ): AlipayPayNotifyResult {
    const client = this.getClient();
    const ok = client.checkNotifySign(payload);
    if (!ok) throw new Error('支付宝回调验签失败');

    const outTradeNo = String(payload['out_trade_no'] ?? '');
    const tradeNo = String(payload['trade_no'] ?? '');
    const paidAmountCents = this.yuanToCents(
      String(payload['total_amount'] ?? '0'),
    );
    const paidAt = payload['gmt_payment']
      ? new Date(String(payload['gmt_payment']))
      : new Date();
    return { outTradeNo, tradeNo, paidAmountCents, paidAt };
  }

  async refund(params: {
    outTradeNo: string;
    outRefundNo: string;
    refundAmountCents: number;
    reason: string;
  }): Promise<AlipayRefundResult> {
    if (this.isSandbox()) {
      return {
        outRefundNo: params.outRefundNo,
        refundId: `ALI_REFUND_${Date.now()}`,
      };
    }

    const client = this.getClient();
    const refundAmount = this.centsToYuan(params.refundAmountCents);
    const res = await client.exec('alipay.trade.refund', {
      bizContent: {
        out_trade_no: params.outTradeNo,
        out_request_no: params.outRefundNo,
        refund_amount: refundAmount,
        refund_reason: params.reason,
      },
    });
    const refundId =
      typeof res === 'object' && res
        ? typeof res['refund_id'] === 'string'
          ? String(res['refund_id'])
          : undefined
        : undefined;
    return {
      outRefundNo: params.outRefundNo,
      refundId,
    };
  }

  async query(outTradeNo: string): Promise<AlipayQueryResult> {
    if (this.isSandbox()) {
      if (outTradeNo.startsWith('SIM_PAID_')) {
        return {
          status: 'PAID',
          transactionId: `SIM_TX_${outTradeNo}`,
          paidAmountCents: 100,
          paidAt: new Date(),
        };
      }
      return { status: 'PENDING' };
    }
    const client = this.getClient();
    const res = await client.exec('alipay.trade.query', {
      bizContent: {
        out_trade_no: outTradeNo,
      },
    });
    if (!res || typeof res !== 'object') return { status: 'PENDING' };
    const r = res;
    const tradeStatus =
      typeof r['trade_status'] === 'string' ? r['trade_status'] : '';
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      const totalAmountRaw = r['total_amount'];
      const totalAmount =
        typeof totalAmountRaw === 'string' ? totalAmountRaw : '0';
      return {
        status: 'PAID',
        transactionId:
          typeof r['trade_no'] === 'string' ? String(r['trade_no']) : undefined,
        paidAmountCents: this.yuanToCents(totalAmount),
        paidAt:
          typeof r['send_pay_date'] === 'string'
            ? new Date(r['send_pay_date'])
            : undefined,
      };
    }
    return { status: 'PENDING' };
  }
}
