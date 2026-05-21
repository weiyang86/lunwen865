import crypto from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { VerifyScene } from '@prisma/client';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class SmsService {
  constructor(private readonly settings: SettingsService) {}

  async sendCode(
    phone: string,
    code: string,
    scene: VerifyScene,
  ): Promise<void> {
    const notify = await this.settings.getNotifySettings();
    if (!notify.sms.enabled) {
      throw new BadRequestException('短信服务未启用');
    }
    if (notify.sms.provider !== 'ALIYUN') {
      throw new BadRequestException('短信服务提供商未配置');
    }

    const accessKeyId = notify.sms.accessKeyId.trim();
    const accessKeySecret = notify.sms.accessKeySecret.trim();
    const signName = notify.sms.signName.trim();
    const templateCode = notify.sms.templateCode.trim();
    if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
      throw new BadRequestException('短信服务未配置完整');
    }

    const params: Record<string, string> = {
      AccessKeyId: accessKeyId,
      Action: 'SendSms',
      Format: 'JSON',
      PhoneNumbers: phone,
      RegionId: notify.sms.region.trim() || 'cn-hangzhou',
      SignName: signName,
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: crypto.randomUUID(),
      SignatureVersion: '1.0',
      TemplateCode: templateCode,
      TemplateParam: JSON.stringify({ code }),
      Timestamp: new Date().toISOString(),
      Version: '2017-05-25',
    };

    const signature = this.signAliyunRpc(params, accessKeySecret);
    const query = new URLSearchParams({ ...params, Signature: signature });
    const url = `https://dysmsapi.aliyuncs.com/?${query.toString()}`;

    const resp = await fetch(url, { method: 'GET' });
    const rawText = await resp.text();
    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new BadRequestException('短信发送失败');
    }

    if (!resp.ok) {
      throw new BadRequestException('短信发送失败');
    }

    const r = data as { Code?: string; Message?: string };
    if (r.Code !== 'OK') {
      throw new BadRequestException(r.Message || '短信发送失败');
    }

    void scene;
  }

  private percentEncode(value: string): string {
    return encodeURIComponent(value)
      .replace(/\+/g, '%20')
      .replace(/\*/g, '%2A')
      .replace(/%7E/g, '~');
  }

  private signAliyunRpc(
    params: Record<string, string>,
    secret: string,
  ): string {
    const sortedKeys = Object.keys(params).sort();
    const canonicalized = sortedKeys
      .map(
        (k) =>
          `${this.percentEncode(k)}=${this.percentEncode(params[k] ?? '')}`,
      )
      .join('&');
    const stringToSign = `GET&%2F&${this.percentEncode(canonicalized)}`;
    const hmac = crypto.createHmac('sha1', `${secret}&`);
    hmac.update(stringToSign);
    return hmac.digest('base64');
  }
}
