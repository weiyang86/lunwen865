import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'node:fs';
import WxPay from 'wechatpay-node-v3';

type WechatNativePrepayResult = { codeUrl: string };

type WechatPayNotifyResult = {
  outTradeNo: string;
  transactionId: string;
  paidAmountCents: number;
  paidAt: Date;
};

type WechatRefundResult = {
  outRefundNo: string;
  refundId?: string;
};

type WechatQueryResult = {
  status: 'PENDING' | 'PAID';
  transactionId?: string;
  paidAmountCents?: number;
  paidAt?: Date;
};

type WxPayTransactionsNativeResponse = {
  code_url?: string;
  codeUrl?: string;
};

type WxPayRefundResponse = {
  refund_id?: string;
};

type WxPayDecipheredResource = {
  out_trade_no: string;
  transaction_id: string;
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
  }) => Promise<WxPayTransactionsNativeResponse>;
  verifySign: (headers: Record<string, string>, body: string) => boolean;
  decipher_gcm: (resource: unknown) => WxPayDecipheredResource;
  refunds: (params: Record<string, unknown>) => Promise<WxPayRefundResponse>;
  query?: (params: {
    out_trade_no: string;
  }) => Promise<Record<string, unknown>>;
};

@Injectable()
export class WechatPayProvider {
  private client: WxPayClient | null = null;

  constructor(private readonly config: ConfigService) {}

  getChannel(): 'WECHAT' {
    return 'WECHAT';
  }

  isSandbox(): boolean {
    return this.config.get<boolean>('payment.sandbox', true) === true;
  }

  private getClient(): WxPayClient {
    if (this.client) return this.client;

    const appid = this.config.get<string>('payment.wechat.appid', '');
    const mchid = this.config.get<string>('payment.wechat.mchid', '');
    const serialNo = this.config.get<string>('payment.wechat.serialNo', '');
    const privateKeyPath = this.config.get<string>(
      'payment.wechat.privateKeyPath',
      '',
    );
    const apiV3Key = this.config.get<string>('payment.wechat.apiV3Key', '');

    const privateKey = privateKeyPath ? fs.readFileSync(privateKeyPath) : '';

    const WxPayCtor = WxPay as unknown as new (
      options: Record<string, unknown>,
    ) => WxPayClient;
    this.client = new WxPayCtor({
      appid,
      mchid,
      serial_no: serialNo,
      privateKey,
      key: apiV3Key,
    });
    return this.client;
  }

  async nativePrepay(params: {
    outTradeNo: string;
    description: string;
    amountCents: number;
    clientIp: string;
    notifyUrl: string;
  }): Promise<WechatNativePrepayResult> {
    if (this.isSandbox()) {
      return {
        codeUrl: `weixin://wxpay/mock?out_trade_no=${params.outTradeNo}`,
      };
    }

    const client = this.getClient();
    const result = await client.transactions_native({
      description: params.description,
      out_trade_no: params.outTradeNo,
      notify_url: params.notifyUrl,
      amount: { total: params.amountCents },
      scene_info: { payer_client_ip: params.clientIp },
    });

    const codeUrl = result.code_url ?? result.codeUrl;
    if (!codeUrl) throw new Error('微信预下单失败');
    return { codeUrl: String(codeUrl) };
  }

  verifyAndParsePayNotify(
    headers: Record<string, string>,
    rawBody: string,
  ): WechatPayNotifyResult {
    const client = this.getClient();
    const ok = client.verifySign(headers, rawBody);
    if (!ok) throw new Error('微信回调验签失败');

    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== 'object')
      throw new Error('微信回调解析失败');
    const body = parsed as Record<string, unknown>;
    const resource = client.decipher_gcm(body['resource']);
    const outTradeNo = String(resource.out_trade_no);
    const transactionId = String(resource.transaction_id);
    const paidAmountCents = Number(resource.amount?.total ?? 0);
    const paidAt = resource.success_time
      ? new Date(resource.success_time)
      : new Date();
    return { outTradeNo, transactionId, paidAmountCents, paidAt };
  }

  async refund(params: {
    outTradeNo: string;
    transactionId?: string;
    outRefundNo: string;
    reason: string;
    refundAmountCents: number;
    totalAmountCents: number;
    notifyUrl: string;
  }): Promise<WechatRefundResult> {
    if (this.isSandbox()) {
      return {
        outRefundNo: params.outRefundNo,
        refundId: `WX_REFUND_${Date.now()}`,
      };
    }

    const client = this.getClient();
    const res = await client.refunds({
      out_trade_no: params.outTradeNo,
      transaction_id: params.transactionId,
      out_refund_no: params.outRefundNo,
      reason: params.reason,
      notify_url: params.notifyUrl,
      amount: {
        refund: params.refundAmountCents,
        total: params.totalAmountCents,
        currency: 'CNY',
      },
    });

    return {
      outRefundNo: params.outRefundNo,
      refundId: res.refund_id ? String(res.refund_id) : undefined,
    };
  }

  async query(outTradeNo: string): Promise<WechatQueryResult> {
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
    if (!client.query) {
      throw new Error('微信 query 能力不可用');
    }
    const res = await client.query({ out_trade_no: outTradeNo });
    const tradeStateRaw = res['trade_state'] ?? res['tradeState'];
    const tradeState = typeof tradeStateRaw === 'string' ? tradeStateRaw : '';
    if (tradeState === 'SUCCESS') {
      const transactionIdRaw = res['transaction_id'];
      const amountRaw = res['amount'];
      let paidAmountCents = 0;
      if (amountRaw && typeof amountRaw === 'object') {
        const v = (amountRaw as Record<string, unknown>)['total'];
        paidAmountCents = Number(
          typeof v === 'number' || typeof v === 'string' ? v : 0,
        );
      }
      const paidAtRaw = res['success_time'];
      return {
        status: 'PAID',
        transactionId:
          typeof transactionIdRaw === 'string' ? transactionIdRaw : undefined,
        paidAmountCents,
        paidAt: typeof paidAtRaw === 'string' ? new Date(paidAtRaw) : undefined,
      };
    }
    return { status: 'PENDING' };
  }
}
