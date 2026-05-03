import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VerifyScene } from '@prisma/client';

@Injectable()
export class SmsService {
  constructor(private readonly configService: ConfigService) {}

  sendCode(phone: string, code: string, scene: VerifyScene): Promise<void> {
    const provider = this.configService.get<string>('SMS_PROVIDER', 'mock');
    if (provider === 'mock') {
      console.log(
        `\n[Mock SMS] 📱 ${phone} 验证码: ${code} (scene=${scene})\n`,
      );
      return Promise.resolve();
    }
    return Promise.reject(
      new Error(`SMS provider ${provider} not implemented`),
    );
  }
}
