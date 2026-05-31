import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import {
  createDecipheriv,
  createSign,
  createVerify,
  randomBytes,
} from 'node:crypto';
import { inspect } from 'node:util';
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

type WechatRuntimeConfig = {
  appid: string;
  mchid: string;
  serialNo: string;
  apiV3Key: string;
  privateKeyRaw: string;
  publicKeyRaw: string;
  publicKeyId: string;
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
    const w = await this.getWechatRuntimeConfig();
    if (
      !w.appid ||
      !w.mchid ||
      !w.serialNo ||
      !w.apiV3Key ||
      !w.privateKeyRaw
    ) {
      this.logger.error(
        '[wechat] 配置不完整，拒绝下单（production 不允许降级 mock）',
      );
      throw new BadRequestException('微信支付未配置完整，请检查环境变量');
    }
    if (!(await this.isSandbox()) && !w.publicKeyRaw) {
      throw new BadRequestException(
        '缺少微信支付公钥：请配置 WECHAT_PAY_PUBLIC_KEY_PATH 或 WECHAT_PAY_PUBLIC_KEY',
      );
    }
  }

  private async getWechatRuntimeConfig(): Promise<WechatRuntimeConfig> {
    const cfg = await this.settings.getPaymentSettings();
    const w = cfg.wechat;
    return {
      appid: w.appid,
      mchid: w.mchid,
      serialNo: w.serialNo,
      apiV3Key: w.apiV3Key,
      privateKeyRaw: w.privateKeyPath,
      publicKeyRaw: String(
        process.env.WECHAT_PAY_PUBLIC_KEY_PATH ??
          process.env.WECHAT_PAY_PUBLIC_KEY ??
          w.publicKeyPath ??
          '',
      ),
      publicKeyId: String(process.env.WECHAT_PAY_PUBLIC_KEY_ID ?? '').trim(),
    };
  }

  private loadSecretContent(raw: string, label: string): string {
    const value = String(raw ?? '').trim();
    if (!value) {
      throw new BadRequestException(`微信支付配置缺失：${label}`);
    }
    const normalized = value.replace(/\\n/g, '\n');
    if (normalized.includes('-----BEGIN')) {
      return normalized;
    }
    if (!existsSync(value)) {
      throw new BadRequestException(`微信支付密钥文件不可读：${label}`);
    }
    return readFileSync(value, 'utf8');
  }

  private verifyWechatPayNotifySignature(params: {
    headers: Record<string, string>;
    rawBody: string;
    platformPublicKey: string;
  }): boolean {
    const headersLower: Record<string, string> = {};
    for (const [k, v] of Object.entries(params.headers ?? {})) {
      headersLower[String(k).toLowerCase()] = String(v);
    }

    const timestamp = headersLower['wechatpay-timestamp'] ?? '';
    const nonce = headersLower['wechatpay-nonce'] ?? '';
    const signatureBase64 = headersLower['wechatpay-signature'] ?? '';
    if (!timestamp || !nonce || !signatureBase64) return false;

    const message = `${timestamp}\n${nonce}\n${params.rawBody}\n`;
    const verifier = createVerify('RSA-SHA256');
    verifier.update(message);
    try {
      return verifier.verify(
        params.platformPublicKey,
        Buffer.from(signatureBase64, 'base64'),
      );
    } catch {
      return false;
    }
  }

  private decryptWechatPayNotifyResource(params: {
    resource: unknown;
    apiV3Key: string;
  }): Record<string, unknown> {
    if (!params.resource || typeof params.resource !== 'object') {
      throw new BadRequestException('微信回调报文不完整：resource 缺失');
    }
    const r = params.resource as Record<string, unknown>;
    const ciphertext = typeof r['ciphertext'] === 'string' ? r['ciphertext'] : '';
    const nonce = typeof r['nonce'] === 'string' ? r['nonce'] : '';
    const associatedData =
      typeof r['associated_data'] === 'string' ? r['associated_data'] : '';
    if (!ciphertext || !nonce) {
      throw new BadRequestException('微信回调报文不完整：ciphertext/nonce 缺失');
    }

    const apiV3Key = String(params.apiV3Key ?? '').trim();
    if (!apiV3Key || apiV3Key.length !== 32) {
      throw new BadRequestException('微信支付配置缺失：APIv3 Key（32 位）');
    }

    const buf = Buffer.from(ciphertext, 'base64');
    if (buf.length <= 16) {
      throw new BadRequestException('微信回调报文解密失败：ciphertext 长度异常');
    }
    const authTag = buf.subarray(buf.length - 16);
    const data = buf.subarray(0, buf.length - 16);

    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(apiV3Key, 'utf8'),
      Buffer.from(nonce, 'utf8'),
    );
    if (associatedData) {
      decipher.setAAD(Buffer.from(associatedData, 'utf8'));
    }
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    const text = decrypted.toString('utf8');
    try {
      const obj = JSON.parse(text) as unknown;
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        return obj as Record<string, unknown>;
      }
      throw new Error('not_object');
    } catch {
      throw new BadRequestException('微信回调报文解密失败：明文非 JSON 对象');
    }
  }

  private safeJson(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      try {
        return String(value);
      } catch {
        return '[unserializable]';
      }
    }
  }

  private parseWechatResponse(response: unknown): unknown {
    if (!response) return response;
    if (typeof response === 'string') {
      const s = response.trim();
      if (!s) return response;
      try {
        return JSON.parse(s) as unknown;
      } catch {
        return response;
      }
    }
    if (typeof response !== 'object') return response;
    const obj = response as Record<string, unknown>;
    const copy: Record<string, unknown> = { ...obj };
    for (const key of ['data', 'body', 'result', 'text'] as const) {
      const v = obj[key];
      if (typeof v === 'string') {
        try {
          copy[key] = JSON.parse(v) as unknown;
        } catch {
          copy[key] = v;
        }
      } else {
        copy[key] = v;
      }
    }
    const rsp = obj['response'];
    if (rsp && typeof rsp === 'object' && !Array.isArray(rsp)) {
      const rspObj = rsp as Record<string, unknown>;
      const rspCopy: Record<string, unknown> = { ...rspObj };
      for (const key of ['data', 'body', 'result', 'text'] as const) {
        const v = rspObj[key];
        if (typeof v === 'string') {
          try {
            rspCopy[key] = JSON.parse(v) as unknown;
          } catch {
            rspCopy[key] = v;
          }
        } else {
          rspCopy[key] = v;
        }
      }
      copy['response'] = rspCopy;
    }
    return copy;
  }

  private sanitizeWechatDebugObject(input: unknown): unknown {
    const allowHeaderKeys = new Set([
      'request-id',
      'wechatpay-serial',
      'content-type',
      'date',
    ]);

    const isSensitiveKey = (rawKey: string): boolean => {
      const k = rawKey.toLowerCase();
      if (k === 'authorization') return true;
      if (k.includes('wechat_pay_api_v3_key')) return true;
      if (k.includes('privatekey')) return true;
      if (k.includes('publickey')) return true;
      if (k.includes('apiclient_key')) return true;
      if (k.includes('pem')) return true;
      if (k.includes('signature')) return true;
      if (k.includes('sign')) return true;
      return false;
    };

    const parseMaybeJson = (value: unknown): unknown => {
      if (typeof value !== 'string') return value;
      const s = value.trim();
      if (!s) return value;
      if (!(s.startsWith('{') || s.startsWith('['))) return value;
      try {
        return JSON.parse(s) as unknown;
      } catch {
        return value;
      }
    };

    const sanitize = (
      value: unknown,
      depth: number,
      keyHint?: string,
    ): unknown => {
      if (depth > 8) return '[truncated]';
      if (keyHint && isSensitiveKey(keyHint)) return '[redacted]';
      if (value == null) return value;

      if (typeof value === 'string') {
        const s = value;
        if (s.includes('-----BEGIN') && s.includes('-----END'))
          return '[redacted_pem]';
        if (s.length > 2000) return `${s.slice(0, 400)}...[truncated]`;
        return parseMaybeJson(s);
      }
      if (typeof value === 'number' || typeof value === 'boolean') return value;
      if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));

      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;

        if (keyHint && keyHint.toLowerCase() === 'headers') {
          const filtered: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(obj)) {
            const lk = k.toLowerCase();
            if (!allowHeaderKeys.has(lk)) continue;
            if (isSensitiveKey(k)) continue;
            filtered[k] = sanitize(v, depth + 1, k);
          }
          return filtered;
        }

        const out: Record<string, unknown> = {};
        const names = Object.getOwnPropertyNames(obj);
        const symbols = Object.getOwnPropertySymbols(obj);
        out.__ownPropertyNames = names.slice(0, 80);
        out.__ownPropertySymbols = symbols.slice(0, 40).map((s) => s.toString());

        const prioritized = new Set([
          'status',
          'statusCode',
          'code',
          'message',
          'detail',
          'data',
          'body',
          'text',
          'error',
          'response',
          'headers',
          'rawData',
          '_data',
          '_body',
        ]);

        const keys: Array<string | symbol> = [
          ...names,
          ...symbols,
        ];
        const sortedKeys = keys.sort((a, b) => {
          const ak = typeof a === 'string' ? a : a.toString();
          const bk = typeof b === 'string' ? b : b.toString();
          const ap = prioritized.has(ak) ? 0 : 1;
          const bp = prioritized.has(bk) ? 0 : 1;
          if (ap !== bp) return ap - bp;
          return ak.localeCompare(bk);
        });

        for (const k of sortedKeys.slice(0, 80)) {
          const key = typeof k === 'string' ? k : k.toString();
          if (isSensitiveKey(key)) {
            out[key] = '[redacted]';
            continue;
          }
          try {
            const v =
              typeof k === 'string'
                ? (obj as Record<string, unknown>)[k]
                : (obj as unknown as Record<symbol, unknown>)[k as symbol];
            out[key] = sanitize(v, depth + 1, key);
          } catch {
            out[key] = '[unreadable]';
          }
        }

        if (value instanceof Error) {
          const err = value as Error & Record<string, unknown>;
          out.name = err.name;
          out.message = err.message;
          out.code = typeof err.code === 'string' ? err.code : undefined;
          out.status = err.status;
          out.statusCode = err.statusCode;
          if (process.env.NODE_ENV !== 'production' && typeof err.stack === 'string') {
            out.stack = err.stack.split('\n').slice(0, 25).join('\n');
          }
        }

        return out;
      }

      try {
        return String(value);
      } catch {
        return '[unknown]';
      }
    };

    return sanitize(input, 0);
  }

  private async normalizeWechatResponse(response: unknown): Promise<Record<string, unknown>> {
    const allowHeaderKeys = new Set([
      'request-id',
      'wechatpay-serial',
      'content-type',
      'date',
    ]);

    const pickHeaders = (headers: unknown): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      if (!headers) return out;

      const getFrom = (key: string): unknown => {
        if (headers && typeof headers === 'object') {
          const h = headers as Record<string, unknown>;
          const direct = h[key] ?? h[key.toLowerCase()] ?? h[key.toUpperCase()];
          if (direct != null) return direct;
          const get = (h as unknown as { get?: (k: string) => unknown }).get;
          if (typeof get === 'function') {
            return get.call(headers, key) ?? get.call(headers, key.toLowerCase());
          }
        }
        return undefined;
      };

      for (const key of allowHeaderKeys) {
        const v = getFrom(key);
        if (typeof v === 'string' && v.trim()) out[key] = v.trim();
      }
      return out;
    };

    const normalizeBodyFromText = (text: string): { body: unknown; data?: unknown; code?: unknown; message?: unknown; detail?: unknown } => {
      const trimmed = text.trim();
      if (!trimmed) return { body: '' };
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const obj = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
        const data = obj ? (obj['data'] ?? obj['body'] ?? obj['result']) : undefined;
        const dataObj = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
        const code = (obj ? (obj['code'] ?? dataObj?.['code']) : undefined);
        const message = (obj ? (obj['message'] ?? dataObj?.['message']) : undefined);
        const detail = (obj ? (obj['detail'] ?? dataObj?.['detail']) : undefined);
        return { body: parsed, data, code, message, detail };
      } catch {
        return { body: trimmed };
      }
    };

    const normalizePlainObject = (obj: Record<string, unknown>): Record<string, unknown> => {
      const parsed = this.parseWechatResponse(obj);
      const o = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : obj;
      const root = (o['response'] && typeof o['response'] === 'object' && !Array.isArray(o['response']))
        ? (o['response'] as Record<string, unknown>)
        : o;

      const status = root['status'] ?? root['statusCode'] ?? o['status'] ?? o['statusCode'];
      const headers = pickHeaders(root['headers'] ?? o['headers']);
      const body = root['body'] ?? root['data'] ?? root['result'] ?? root['text'] ?? o['body'] ?? o['data'] ?? o['result'] ?? o['text'];
      const bodyObj = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
      const code = o['code'] ?? root['code'] ?? bodyObj?.['code'];
      const message = o['message'] ?? root['message'] ?? bodyObj?.['message'];
      const detail = o['detail'] ?? root['detail'] ?? bodyObj?.['detail'];

      return {
        status,
        statusCode: status,
        headers,
        body,
        data: o['data'] ?? root['data'] ?? bodyObj?.['data'],
        code,
        message,
        detail,
        result: o['result'] ?? root['result'],
      };
    };

    if (typeof response === 'string') {
      const parsed = this.parseWechatResponse(response);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return normalizePlainObject(parsed as Record<string, unknown>);
      }
      return { body: parsed };
    }

    if (response && typeof response === 'object' && !Array.isArray(response)) {
      const rsp = response as Record<string, unknown>;

      const hasStatus = typeof rsp['status'] === 'number' || typeof rsp['statusCode'] === 'number';
      const hasText = typeof (rsp as unknown as { text?: unknown }).text === 'function';
      const hasJson = typeof (rsp as unknown as { json?: unknown }).json === 'function';
      if (hasStatus && (hasText || hasJson)) {
        const status = (rsp['status'] ?? rsp['statusCode']) as unknown;
        const headers = pickHeaders(rsp['headers']);

        const cloner = (rsp as unknown as { clone?: () => unknown }).clone;
        const target = typeof cloner === 'function' ? cloner.call(response) : response;

        let text: string | null = null;
        const textFn = (target as unknown as { text?: () => Promise<unknown> }).text;
        if (typeof textFn === 'function') {
          try {
            const t = await textFn.call(target);
            text = typeof t === 'string' ? t : this.safeJson(t);
          } catch {
            text = null;
          }
        }
        if (text == null) {
          const jsonFn = (target as unknown as { json?: () => Promise<unknown> }).json;
          if (typeof jsonFn === 'function') {
            try {
              const j = await jsonFn.call(target);
              const normalized = normalizePlainObject({ status, statusCode: status, headers, body: j, data: j } as Record<string, unknown>);
              return normalized;
            } catch {
              return { status, statusCode: status, headers, body: null };
            }
          }
          return { status, statusCode: status, headers, body: null };
        }

        const normalizedBody = normalizeBodyFromText(text);
        return {
          status,
          statusCode: status,
          headers,
          body: normalizedBody.body,
          data: normalizedBody.data,
          code: normalizedBody.code,
          message: normalizedBody.message,
          detail: normalizedBody.detail,
          text: text,
        };
      }

      return normalizePlainObject(rsp);
    }

    return { body: response };
  }

  private extractWechatCodeUrl(response: unknown): string | undefined {
    const parsed = this.parseWechatResponse(response);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const obj = parsed as Record<string, unknown>;
    const direct = obj['code_url'] ?? obj['codeUrl'];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    for (const containerKey of ['data', 'body', 'result'] as const) {
      const container = obj[containerKey];
      if (!container || typeof container !== 'object') continue;
      const nested = container as Record<string, unknown>;
      const value = nested['code_url'] ?? nested['codeUrl'];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  }

  private summarizeWechatResponse(response: unknown): Record<string, unknown> {
    return this.sanitizeWechatDebugObject(this.parseWechatResponse(response)) as Record<
      string,
      unknown
    >;
  }

  private summarizeWechatError(error: unknown): Record<string, unknown> {
    const ownNames =
      error && typeof error === 'object'
        ? Object.getOwnPropertyNames(error as object)
        : [];
    const ownSymbols =
      error && typeof error === 'object'
        ? Object.getOwnPropertySymbols(error as object).map((s) => s.toString())
        : [];

    const errObj =
      error && typeof error === 'object' && !Array.isArray(error)
        ? (error as Record<string, unknown>)
        : null;

    const response = errObj && errObj['response'] ? errObj['response'] : null;
    const base = this.sanitizeWechatDebugObject({
      ownPropertyNames: ownNames,
      ownPropertySymbols: ownSymbols,
      name: errObj && typeof errObj['name'] === 'string' ? errObj['name'] : undefined,
      message:
        error instanceof Error
          ? error.message
          : errObj && typeof errObj['message'] === 'string'
            ? errObj['message']
            : undefined,
      code: errObj ? errObj['code'] : undefined,
      status: errObj ? errObj['status'] : undefined,
      statusCode: errObj ? errObj['statusCode'] : undefined,
      data: errObj ? errObj['data'] : undefined,
      body: errObj ? errObj['body'] : undefined,
      headers: errObj ? errObj['headers'] : undefined,
      response: response,
      responseStatus:
        response && typeof response === 'object'
          ? (response as Record<string, unknown>)['status'] ??
            (response as Record<string, unknown>)['statusCode']
          : undefined,
      responseData:
        response && typeof response === 'object'
          ? (response as Record<string, unknown>)['data']
          : undefined,
      responseBody:
        response && typeof response === 'object'
          ? (response as Record<string, unknown>)['body']
          : undefined,
      responseText:
        response && typeof response === 'object'
          ? (response as Record<string, unknown>)['text']
          : undefined,
    });

    return base && typeof base === 'object'
      ? (base as Record<string, unknown>)
      : { error: String(base) };
  }

  private async getClient(): Promise<WxPayClient> {
    await this.assertWechatConfigReady();
    const w = await this.getWechatRuntimeConfig();
    const key = [w.appid, w.mchid, w.serialNo, w.privateKeyRaw, w.publicKeyRaw, w.publicKeyId, 'wechat'].join('|');
    if (this.client && this.clientKey === key) return this.client;

    const privateKey = this.loadSecretContent(w.privateKeyRaw, 'privateKeyPath');
    const publicKey = w.publicKeyRaw
      ? this.loadSecretContent(w.publicKeyRaw, 'publicKeyPath')
      : '';
    if (!(await this.isSandbox()) && !publicKey) {
      throw new BadRequestException(
        '缺少微信支付公钥：请配置 WECHAT_PAY_PUBLIC_KEY_PATH 或 WECHAT_PAY_PUBLIC_KEY',
      );
    }
    const WxPayCtor = WxPay as unknown as new (
      options: Record<string, unknown>,
    ) => WxPayClient;
    this.client = new WxPayCtor({
      appid: w.appid,
      mchid: w.mchid,
      serial_no: w.serialNo,
      privateKey,
      key: w.apiV3Key,
      publicKey: publicKey || undefined,
      publicKeyId: w.publicKeyId || undefined,
    });
    this.clientKey = key;
    return this.client;
  }

  private async directNativePrepay(params: {
    outTradeNo: string;
    description: string;
    amountCents: number;
    clientIp: string;
    notifyUrl: string;
  }): Promise<WechatNativePrepayResult> {
    await this.assertWechatConfigReady();
    if (await this.isSandbox()) {
      this.logger.warn('[wechat] directNativePrepay 跳过：sandbox/mock 模式');
      const raw = {
        code_url: `weixin://wxpay/mock?out_trade_no=${params.outTradeNo}`,
      };
      return { codeUrl: String(raw.code_url), rawResponse: raw };
    }

    const runtime = await this.getWechatRuntimeConfig();
    const serialNo = String(process.env.WECHAT_PAY_CERT_SERIAL_NO ?? '').trim();
    const privateKeyRaw = String(
      process.env.WECHAT_PAY_PRIVATE_KEY_PATH ??
        process.env.WECHAT_PAY_PRIVATE_KEY ??
        '',
    );
    if (!serialNo) {
      throw new BadRequestException('微信支付配置缺失：WECHAT_PAY_CERT_SERIAL_NO');
    }
    if (!privateKeyRaw) {
      throw new BadRequestException(
        '微信支付配置缺失：WECHAT_PAY_PRIVATE_KEY_PATH 或 WECHAT_PAY_PRIVATE_KEY',
      );
    }

    const privateKey = this.loadSecretContent(privateKeyRaw, 'WECHAT_PAY_PRIVATE_KEY');
    const urlPath = '/v3/pay/transactions/native';
    const payload = {
      appid: runtime.appid,
      mchid: runtime.mchid,
      description: params.description,
      out_trade_no: params.outTradeNo,
      notify_url: params.notifyUrl,
      amount: { total: params.amountCents, currency: 'CNY' as const },
    };
    const body = JSON.stringify(payload);

    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(16).toString('hex');
    const signMessage = `POST\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
    const signature = createSign('RSA-SHA256')
      .update(signMessage)
      .sign(privateKey, 'base64');

    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${runtime.mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`;

    const rsp = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body,
    });

    const requestId = rsp.headers.get('request-id');
    const wechatpaySerial = rsp.headers.get('wechatpay-serial');
    const contentType = rsp.headers.get('content-type');
    const date = rsp.headers.get('date');

    const text = await rsp.text();
    let parsed: unknown = text;
    try {
      parsed = text && text.trim() ? (JSON.parse(text) as unknown) : text;
    } catch {
      parsed = text;
    }

    const normalized = await this.normalizeWechatResponse({
      status: rsp.status,
      statusCode: rsp.status,
      headers: {
        'request-id': requestId ?? undefined,
        'wechatpay-serial': wechatpaySerial ?? undefined,
        'content-type': contentType ?? undefined,
        date: date ?? undefined,
      },
      body: parsed,
      data: parsed,
      text,
    });

    const summary = this.summarizeWechatResponse(normalized);
    const code = typeof summary.code === 'string' ? summary.code.trim() : '';
    const message =
      typeof summary.message === 'string' ? summary.message.trim() : '';
    const detail =
      typeof summary.detail === 'string' ? summary.detail.trim() : '';

    this.logger.log(
      `[wechat] directNativePrepay rsp status=${rsp.status} request-id=${requestId ?? ''} wechatpay-serial=${wechatpaySerial ?? ''} code=${code} message=${message} detail=${detail}`,
    );
    this.logger.debug(
      `[wechat] directNativePrepay rsp inspect=${inspect(summary, { depth: 8, showHidden: true })}`,
    );

    const codeUrl = this.extractWechatCodeUrl(normalized);
    if (codeUrl) {
      if (
        String(codeUrl).includes('wxpay/mock') ||
        String(codeUrl).includes('weixin://wxpay/mock')
      ) {
        throw new BadRequestException('微信 Native 下单失败：返回了 mock 二维码');
      }
      return { codeUrl: String(codeUrl), rawResponse: normalized };
    }

    if (code && message) {
      throw new BadRequestException(`微信 Native 下单失败：${code} - ${message}`);
    }
    if (rsp.status === 403) {
      throw new BadRequestException(
        '微信 Native 下单失败：HTTP 403，微信未返回可解析错误体',
      );
    }
    throw new BadRequestException(
      `微信 Native 下单失败：HTTP ${rsp.status}，微信未返回错误体`,
    );
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
      const result = await this.directNativePrepay(params);
      const normalized = await this.normalizeWechatResponse(result.rawResponse);
      const codeUrl = this.extractWechatCodeUrl(normalized) ?? result.codeUrl;
      if (!codeUrl) {
        const summary = this.summarizeWechatResponse(normalized);
        this.logger.error(`[wechat] nativePrepay 未返回 code_url summary=${this.safeJson(summary)}`);
        this.logger.error(
          `[wechat] nativePrepay 未返回 code_url inspect=${inspect(summary, { depth: 8, showHidden: true })}`,
        );
        const httpStatus = Number(summary.statusCode ?? summary.status ?? NaN);
        const code = typeof summary.code === 'string' ? summary.code.trim() : '';
        const message = typeof summary.message === 'string' ? summary.message.trim() : '';
        const merged =
          code && message ? `${code} - ${message}` : (code || message);
        if (Number.isFinite(httpStatus) && httpStatus === 403 && merged) {
          throw new BadRequestException(`微信 Native 下单失败：${merged}`);
        }
        if (Number.isFinite(httpStatus) && httpStatus >= 400 && httpStatus < 600) {
          const detail = merged ? ` - ${merged}` : '';
          throw new BadRequestException(
            `微信 Native 下单失败：HTTP ${httpStatus}${detail}`,
          );
        }
        if (merged) throw new BadRequestException(`微信 Native 下单失败：${merged}`);
        if (Number.isFinite(httpStatus) && httpStatus === 403) {
          throw new BadRequestException(
            '微信 Native 下单失败：HTTP 403，微信未返回可解析错误体',
          );
        }
        throw new BadRequestException('微信 Native 下单失败：未返回 code_url');
      }
      if (String(codeUrl).includes('wxpay/mock') || String(codeUrl).includes('weixin://wxpay/mock')) {
        throw new BadRequestException(
          '微信 Native 下单失败：返回了 mock 二维码',
        );
      }
      this.logger.log('[wechat] nativePrepay 真实下单成功');
      return { codeUrl: String(codeUrl), rawResponse: result };
    } catch (error: unknown) {
      const errSummary = this.summarizeWechatError(error);
      this.logger.error(`[wechat] nativePrepay 调用失败 summary=${this.safeJson(errSummary)}`);
      this.logger.error(
        `[wechat] nativePrepay 调用失败 inspect=${inspect(errSummary, { depth: 8, showHidden: true })}`,
      );
      if (error instanceof BadRequestException) throw error;

      const wechat =
        errSummary && typeof errSummary === 'object'
          ? (errSummary as Record<string, unknown>)['wechat']
          : undefined;
      const wechatObj =
        wechat && typeof wechat === 'object' && !Array.isArray(wechat)
          ? (wechat as Record<string, unknown>)
          : {};
      const httpStatus = Number(
        (errSummary as Record<string, unknown>)['statusCode'] ??
          (errSummary as Record<string, unknown>)['status'] ??
          (wechatObj['statusCode'] as unknown) ??
          (wechatObj['status'] as unknown) ??
          (wechatObj['error'] && typeof wechatObj['error'] === 'object'
            ? (wechatObj['error'] as Record<string, unknown>)['statusCode'] ??
              (wechatObj['error'] as Record<string, unknown>)['status']
            : undefined) ??
          NaN,
      );
      const code = String(
        wechatObj['code'] ??
          (wechatObj['error'] && typeof wechatObj['error'] === 'object'
            ? (wechatObj['error'] as Record<string, unknown>)['code']
            : '') ??
          '',
      ).trim();
      const message = String(
        wechatObj['message'] ??
          (wechatObj['error'] && typeof wechatObj['error'] === 'object'
            ? (wechatObj['error'] as Record<string, unknown>)['message']
            : '') ??
          '',
      ).trim();
      const merged = code && message ? `${code} - ${message}` : (code || message);
      if (merged) {
        throw new BadRequestException(`微信 Native 下单失败：${merged}`);
      }
      if (Number.isFinite(httpStatus) && httpStatus === 403) {
        throw new BadRequestException(
          '微信 Native 下单失败：HTTP 403，微信 SDK 未暴露响应体，请检查 Native 支付权限、AppID 与商户号绑定、商户证书序列号和私钥是否匹配。',
        );
      }
      if (Number.isFinite(httpStatus) && httpStatus >= 400 && httpStatus < 600) {
        throw new BadRequestException(`微信 Native 下单失败：HTTP ${httpStatus}`);
      }
      throw new BadRequestException(
        `微信 Native 下单失败：${error instanceof Error ? error.message : String(error)}`,
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
    await this.assertWechatConfigReady();
    const w = await this.getWechatRuntimeConfig();
    const platformPublicKey = this.loadSecretContent(w.publicKeyRaw, 'publicKeyPath');
    const verified = this.verifyWechatPayNotifySignature({
      headers,
      rawBody,
      platformPublicKey,
    });
    if (!verified) throw new BadRequestException('微信回调验签失败');
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const resource = this.decryptWechatPayNotifyResource({
      resource: body['resource'],
      apiV3Key: w.apiV3Key,
    }) as WxPayDecipheredResource;
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

  private async directQueryTrade(outTradeNo: string): Promise<{
    status: 'PENDING' | 'PAID';
    transactionId?: string;
    paidAmountCents?: number;
    paidAt?: Date;
  }> {
    await this.assertWechatConfigReady();
    if (await this.isSandbox()) {
      return { status: 'PENDING' as const };
    }

    const runtime = await this.getWechatRuntimeConfig();
    const serialNo = String(process.env.WECHAT_PAY_CERT_SERIAL_NO ?? '').trim();
    const privateKeyRaw = String(
      process.env.WECHAT_PAY_PRIVATE_KEY_PATH ??
        process.env.WECHAT_PAY_PRIVATE_KEY ??
        '',
    );
    if (!serialNo || !privateKeyRaw) {
      return { status: 'PENDING' as const };
    }
    const privateKey = this.loadSecretContent(privateKeyRaw, 'WECHAT_PAY_PRIVATE_KEY');

    const pathWithQuery = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(runtime.mchid)}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(16).toString('hex');
    const signMessage = `GET\n${pathWithQuery}\n${timestamp}\n${nonce}\n\n`;
    const signature = createSign('RSA-SHA256')
      .update(signMessage)
      .sign(privateKey, 'base64');
    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${runtime.mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`;

    const rsp = await fetch(`https://api.mch.weixin.qq.com${pathWithQuery}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
      },
    });

    const text = await rsp.text();
    let parsed: unknown = text;
    try {
      parsed = text && text.trim() ? (JSON.parse(text) as unknown) : text;
    } catch {
      parsed = text;
    }

    const normalized = await this.normalizeWechatResponse({
      status: rsp.status,
      statusCode: rsp.status,
      headers: {
        'request-id': rsp.headers.get('request-id') ?? undefined,
        'wechatpay-serial': rsp.headers.get('wechatpay-serial') ?? undefined,
        'content-type': rsp.headers.get('content-type') ?? undefined,
        date: rsp.headers.get('date') ?? undefined,
      },
      body: parsed,
      data: parsed,
      text,
    });

    if (!rsp.ok) {
      const summary = this.summarizeWechatResponse(normalized);
      this.logger.warn(
        `[wechat] directQueryTrade http=${rsp.status} summary=${this.safeJson(summary)}`,
      );
      return { status: 'PENDING' as const };
    }

    const body =
      normalized && typeof normalized === 'object'
        ? (normalized.body as unknown)
        : undefined;
    const bodyObj =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    const tradeState = String(bodyObj?.['trade_state'] ?? '');
    if (tradeState !== 'SUCCESS') {
      return { status: 'PENDING' as const };
    }

    const amountRaw =
      bodyObj?.['amount'] && typeof bodyObj['amount'] === 'object'
        ? (bodyObj['amount'] as Record<string, unknown>)['total']
        : undefined;
    const successTime = bodyObj?.['success_time'];
    return {
      status: 'PAID',
      transactionId: typeof bodyObj?.['transaction_id'] === 'string' ? bodyObj['transaction_id'] : undefined,
      paidAmountCents: Number(amountRaw ?? 0),
      paidAt: successTime ? new Date(String(successTime)) : undefined,
    };
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
    return this.directQueryTrade(outTradeNo);
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
