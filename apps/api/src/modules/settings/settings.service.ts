import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type PaymentSdkSettings = {
  sandbox: boolean;
  orderExpireMinutes: number;
  wechat: {
    notifyUrl: string;
    appid: string;
    mchid: string;
    serialNo: string;
    privateKeyPath: string;
    apiV3Key: string;
  };
  alipay: {
    notifyUrl: string;
    returnUrl: string;
    appId: string;
    gateway: string;
    privateKeyPath: string;
    publicKeyPath: string;
  };
};

type PaymentSettingsForAdmin = {
  sandbox: boolean;
  orderExpireMinutes: number;
  wechat: {
    notifyUrl: string;
    appid: string;
    mchid: string;
    serialNo: string;
    privateKeyPath: string;
    apiV3KeyConfigured: boolean;
  };
  alipay: {
    notifyUrl: string;
    returnUrl: string;
    appId: string;
    gateway: string;
    privateKeyPath: string;
    publicKeyPath: string;
  };
};

type SiteSettings = {
  siteName: string;
  siteUrl: string;
  logoUrl: string;
  supportEmail: string;
  registerGift: {
    paperGeneration: number;
    polish: number;
    export: number;
  };
  exchangeRates: {
    paperGeneration: number;
    polish: number;
    export: number;
    aiChat: number;
  };
};

type SettingKey = 'PAYMENT' | 'SITE';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value))
    return Math.trunc(value);
  return undefined;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getPaymentSettings(): Promise<PaymentSdkSettings> {
    const defaults: PaymentSdkSettings = {
      sandbox: this.config.get<boolean>('payment.sandbox', true) === true,
      orderExpireMinutes: this.config.get<number>(
        'payment.orderExpireMinutes',
        30,
      ),
      wechat: {
        notifyUrl: this.config.get<string>('payment.wechat.notifyUrl', ''),
        appid: this.config.get<string>('payment.wechat.appid', ''),
        mchid: this.config.get<string>('payment.wechat.mchid', ''),
        serialNo: this.config.get<string>('payment.wechat.serialNo', ''),
        privateKeyPath: this.config.get<string>(
          'payment.wechat.privateKeyPath',
          '',
        ),
        apiV3Key: this.config.get<string>('payment.wechat.apiV3Key', ''),
      },
      alipay: {
        notifyUrl: this.config.get<string>('payment.alipay.notifyUrl', ''),
        returnUrl: this.config.get<string>('payment.alipay.returnUrl', ''),
        appId: this.config.get<string>('payment.alipay.appId', ''),
        gateway: this.config.get<string>('payment.alipay.gateway', ''),
        privateKeyPath: this.config.get<string>(
          'payment.alipay.privateKeyPath',
          '',
        ),
        publicKeyPath: this.config.get<string>(
          'payment.alipay.publicKeyPath',
          '',
        ),
      },
    };

    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'PAYMENT' },
      select: { value: true },
    });
    const raw = asRecord(row?.value);

    const wechat = asRecord(raw['wechat']);
    const alipay = asRecord(raw['alipay']);

    return {
      sandbox: asBoolean(raw['sandbox']) ?? defaults.sandbox,
      orderExpireMinutes:
        asInt(raw['orderExpireMinutes']) ?? defaults.orderExpireMinutes,
      wechat: {
        notifyUrl: asString(wechat['notifyUrl']) ?? defaults.wechat.notifyUrl,
        appid: asString(wechat['appid']) ?? defaults.wechat.appid,
        mchid: asString(wechat['mchid']) ?? defaults.wechat.mchid,
        serialNo: asString(wechat['serialNo']) ?? defaults.wechat.serialNo,
        privateKeyPath:
          asString(wechat['privateKeyPath']) ?? defaults.wechat.privateKeyPath,
        apiV3Key: asString(wechat['apiV3Key']) ?? defaults.wechat.apiV3Key,
      },
      alipay: {
        notifyUrl: asString(alipay['notifyUrl']) ?? defaults.alipay.notifyUrl,
        returnUrl: asString(alipay['returnUrl']) ?? defaults.alipay.returnUrl,
        appId: asString(alipay['appId']) ?? defaults.alipay.appId,
        gateway: asString(alipay['gateway']) ?? defaults.alipay.gateway,
        privateKeyPath:
          asString(alipay['privateKeyPath']) ?? defaults.alipay.privateKeyPath,
        publicKeyPath:
          asString(alipay['publicKeyPath']) ?? defaults.alipay.publicKeyPath,
      },
    };
  }

  async getPaymentSettingsForAdmin(): Promise<PaymentSettingsForAdmin> {
    const s = await this.getPaymentSettings();
    return {
      sandbox: s.sandbox,
      orderExpireMinutes: s.orderExpireMinutes,
      wechat: {
        notifyUrl: s.wechat.notifyUrl,
        appid: s.wechat.appid,
        mchid: s.wechat.mchid,
        serialNo: s.wechat.serialNo,
        privateKeyPath: s.wechat.privateKeyPath,
        apiV3KeyConfigured: Boolean(String(s.wechat.apiV3Key ?? '').trim()),
      },
      alipay: {
        notifyUrl: s.alipay.notifyUrl,
        returnUrl: s.alipay.returnUrl,
        appId: s.alipay.appId,
        gateway: s.alipay.gateway,
        privateKeyPath: s.alipay.privateKeyPath,
        publicKeyPath: s.alipay.publicKeyPath,
      },
    };
  }

  async getSiteSettings(): Promise<SiteSettings> {
    const defaults: SiteSettings = {
      siteName: this.config.get<string>('site.name', '论文通'),
      siteUrl: this.config.get<string>('site.url', ''),
      logoUrl: this.config.get<string>('site.logoUrl', ''),
      supportEmail: this.config.get<string>('site.supportEmail', ''),
      registerGift: {
        paperGeneration: this.config.get<number>(
          'payment.registerGift.paperGeneration',
          1,
        ),
        polish: this.config.get<number>('payment.registerGift.polish', 2),
        export: this.config.get<number>('payment.registerGift.export', 1),
      },
      exchangeRates: {
        paperGeneration: 1,
        polish: 1,
        export: 1,
        aiChat: 1,
      },
    };

    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'SITE' },
      select: { value: true },
    });
    const raw = asRecord(row?.value);

    const registerGift = asRecord(raw['registerGift']);
    const legacyGift = registerGift;
    const exchangeRates = asRecord(raw['exchangeRates']);

    return {
      siteName: asString(raw['siteName']) ?? defaults.siteName,
      siteUrl: asString(raw['siteUrl']) ?? defaults.siteUrl,
      logoUrl: asString(raw['logoUrl']) ?? defaults.logoUrl,
      supportEmail: asString(raw['supportEmail']) ?? defaults.supportEmail,
      registerGift: {
        paperGeneration:
          asInt(legacyGift['paperGeneration']) ??
          defaults.registerGift.paperGeneration,
        polish: asInt(legacyGift['polish']) ?? defaults.registerGift.polish,
        export: asInt(legacyGift['export']) ?? defaults.registerGift.export,
      },
      exchangeRates: {
        paperGeneration:
          asInt(exchangeRates['paperGeneration']) ??
          defaults.exchangeRates.paperGeneration,
        polish: asInt(exchangeRates['polish']) ?? defaults.exchangeRates.polish,
        export: asInt(exchangeRates['export']) ?? defaults.exchangeRates.export,
        aiChat: asInt(exchangeRates['aiChat']) ?? defaults.exchangeRates.aiChat,
      },
    };
  }

  async updatePaymentSettings(patch: {
    sandbox?: boolean;
    orderExpireMinutes?: number;
    wechatAppid?: string;
    wechatMchid?: string;
    wechatSerialNo?: string;
    wechatPrivateKeyPath?: string;
    wechatApiV3Key?: string;
    wechatNotifyUrl?: string;
    alipayAppId?: string;
    alipayGateway?: string;
    alipayPrivateKeyPath?: string;
    alipayPublicKeyPath?: string;
    alipayNotifyUrl?: string;
    alipayReturnUrl?: string;
  }): Promise<PaymentSettingsForAdmin> {
    const current = await this.prisma.systemSetting.findUnique({
      where: { key: 'PAYMENT' },
      select: { value: true },
    });
    const raw = asRecord(current?.value);
    const next: Record<string, unknown> = { ...raw };

    if (typeof patch.sandbox === 'boolean') next['sandbox'] = patch.sandbox;
    if (typeof patch.orderExpireMinutes === 'number') {
      next['orderExpireMinutes'] = Math.trunc(patch.orderExpireMinutes);
    }

    const wechat = { ...asRecord(next['wechat']) };
    if (typeof patch.wechatNotifyUrl === 'string') {
      wechat['notifyUrl'] = patch.wechatNotifyUrl.trim();
    }
    if (typeof patch.wechatAppid === 'string')
      wechat['appid'] = patch.wechatAppid.trim();
    if (typeof patch.wechatMchid === 'string')
      wechat['mchid'] = patch.wechatMchid.trim();
    if (typeof patch.wechatSerialNo === 'string')
      wechat['serialNo'] = patch.wechatSerialNo.trim();
    if (typeof patch.wechatPrivateKeyPath === 'string')
      wechat['privateKeyPath'] = patch.wechatPrivateKeyPath.trim();
    if (typeof patch.wechatApiV3Key === 'string') {
      const v = patch.wechatApiV3Key.trim();
      if (v) wechat['apiV3Key'] = v;
    }
    next['wechat'] = wechat;

    const alipay = { ...asRecord(next['alipay']) };
    if (typeof patch.alipayNotifyUrl === 'string') {
      alipay['notifyUrl'] = patch.alipayNotifyUrl.trim();
    }
    if (typeof patch.alipayReturnUrl === 'string') {
      alipay['returnUrl'] = patch.alipayReturnUrl.trim();
    }
    if (typeof patch.alipayAppId === 'string')
      alipay['appId'] = patch.alipayAppId.trim();
    if (typeof patch.alipayGateway === 'string')
      alipay['gateway'] = patch.alipayGateway.trim();
    if (typeof patch.alipayPrivateKeyPath === 'string')
      alipay['privateKeyPath'] = patch.alipayPrivateKeyPath.trim();
    if (typeof patch.alipayPublicKeyPath === 'string')
      alipay['publicKeyPath'] = patch.alipayPublicKeyPath.trim();
    next['alipay'] = alipay;

    await this.upsertSetting('PAYMENT', next as Prisma.InputJsonValue);
    return this.getPaymentSettingsForAdmin();
  }

  async updateSiteSettings(patch: {
    siteName?: string;
    siteUrl?: string;
    logoUrl?: string;
    supportEmail?: string;
    registerGiftPaperGeneration?: number;
    registerGiftPolish?: number;
    registerGiftExport?: number;
    exchangeRatePaperGeneration?: number;
    exchangeRatePolish?: number;
    exchangeRateExport?: number;
    exchangeRateAiChat?: number;
  }): Promise<SiteSettings> {
    const current = await this.prisma.systemSetting.findUnique({
      where: { key: 'SITE' },
      select: { value: true },
    });
    const raw = asRecord(current?.value);
    const next: Record<string, unknown> = { ...raw };

    if (typeof patch.siteName === 'string')
      next['siteName'] = patch.siteName.trim();
    if (typeof patch.siteUrl === 'string')
      next['siteUrl'] = patch.siteUrl.trim();
    if (typeof patch.logoUrl === 'string')
      next['logoUrl'] = patch.logoUrl.trim();
    if (typeof patch.supportEmail === 'string') {
      next['supportEmail'] = patch.supportEmail.trim();
    }

    const rg = { ...asRecord(next['registerGift']) };
    if (typeof patch.registerGiftPaperGeneration === 'number') {
      rg['paperGeneration'] = Math.trunc(patch.registerGiftPaperGeneration);
    }
    if (typeof patch.registerGiftPolish === 'number') {
      rg['polish'] = Math.trunc(patch.registerGiftPolish);
    }
    if (typeof patch.registerGiftExport === 'number') {
      rg['export'] = Math.trunc(patch.registerGiftExport);
    }
    next['registerGift'] = rg;

    const er = { ...asRecord(next['exchangeRates']) };
    if (typeof patch.exchangeRatePaperGeneration === 'number') {
      er['paperGeneration'] = Math.trunc(patch.exchangeRatePaperGeneration);
    }
    if (typeof patch.exchangeRatePolish === 'number') {
      er['polish'] = Math.trunc(patch.exchangeRatePolish);
    }
    if (typeof patch.exchangeRateExport === 'number') {
      er['export'] = Math.trunc(patch.exchangeRateExport);
    }
    if (typeof patch.exchangeRateAiChat === 'number') {
      er['aiChat'] = Math.trunc(patch.exchangeRateAiChat);
    }
    next['exchangeRates'] = er;

    await this.upsertSetting('SITE', next as Prisma.InputJsonValue);
    return this.getSiteSettings();
  }

  private async upsertSetting(key: SettingKey, value: Prisma.InputJsonValue) {
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
      select: { id: true },
    });
  }
}

export type { PaymentSdkSettings, PaymentSettingsForAdmin, SiteSettings };
