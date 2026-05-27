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
    publicKeyPath: string;
    platformCertPath: string;
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

type NotifySettings = {
  sms: {
    provider: 'ALIYUN';
    enabled: boolean;
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    signName: string;
    templateCode: string;
    codeTtlSeconds: number;
  };
  email: {
    provider: 'SMTP';
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromEmail: string;
    fromName: string;
  };
};

type NotifySettingsForAdmin = {
  sms: Omit<NotifySettings['sms'], 'accessKeySecret'> & {
    accessKeySecretConfigured: boolean;
  };
  email: Omit<NotifySettings['email'], 'pass'> & { passConfigured: boolean };
};

type SettingKey = 'PAYMENT' | 'SITE' | 'NOTIFY';

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
        publicKeyPath: this.config.get<string>(
          'payment.wechat.publicKeyPath',
          '',
        ),
        platformCertPath: this.config.get<string>(
          'payment.wechat.platformCertPath',
          '',
        ),
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
        publicKeyPath:
          asString(wechat['publicKeyPath']) ?? defaults.wechat.publicKeyPath,
        platformCertPath:
          asString(wechat['platformCertPath']) ??
          defaults.wechat.platformCertPath,
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

  async getNotifySettings(): Promise<NotifySettings> {
    const defaults: NotifySettings = {
      sms: {
        provider: 'ALIYUN',
        enabled: false,
        region: 'cn-hangzhou',
        accessKeyId: '',
        accessKeySecret: '',
        signName: '',
        templateCode: '',
        codeTtlSeconds: 300,
      },
      email: {
        provider: 'SMTP',
        enabled: false,
        host: 'smtp.163.com',
        port: 465,
        secure: true,
        user: '',
        pass: '',
        fromEmail: '',
        fromName: '',
      },
    };

    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'NOTIFY' },
      select: { value: true },
    });
    const raw = asRecord(row?.value);
    const sms = asRecord(raw['sms']);
    const email = asRecord(raw['email']);

    return {
      sms: {
        provider: 'ALIYUN',
        enabled: asBoolean(sms['enabled']) ?? defaults.sms.enabled,
        region: asString(sms['region']) ?? defaults.sms.region,
        accessKeyId: asString(sms['accessKeyId']) ?? defaults.sms.accessKeyId,
        accessKeySecret:
          asString(sms['accessKeySecret']) ?? defaults.sms.accessKeySecret,
        signName: asString(sms['signName']) ?? defaults.sms.signName,
        templateCode:
          asString(sms['templateCode']) ?? defaults.sms.templateCode,
        codeTtlSeconds:
          asInt(sms['codeTtlSeconds']) ?? defaults.sms.codeTtlSeconds,
      },
      email: {
        provider: 'SMTP',
        enabled: asBoolean(email['enabled']) ?? defaults.email.enabled,
        host: asString(email['host']) ?? defaults.email.host,
        port: asInt(email['port']) ?? defaults.email.port,
        secure: asBoolean(email['secure']) ?? defaults.email.secure,
        user: asString(email['user']) ?? defaults.email.user,
        pass: asString(email['pass']) ?? defaults.email.pass,
        fromEmail: asString(email['fromEmail']) ?? defaults.email.fromEmail,
        fromName: asString(email['fromName']) ?? defaults.email.fromName,
      },
    };
  }

  async getNotifySettingsForAdmin(): Promise<NotifySettingsForAdmin> {
    const s = await this.getNotifySettings();
    return {
      sms: {
        provider: s.sms.provider,
        enabled: s.sms.enabled,
        region: s.sms.region,
        accessKeyId: s.sms.accessKeyId,
        accessKeySecretConfigured: Boolean(
          String(s.sms.accessKeySecret).trim(),
        ),
        signName: s.sms.signName,
        templateCode: s.sms.templateCode,
        codeTtlSeconds: s.sms.codeTtlSeconds,
      },
      email: {
        provider: s.email.provider,
        enabled: s.email.enabled,
        host: s.email.host,
        port: s.email.port,
        secure: s.email.secure,
        user: s.email.user,
        passConfigured: Boolean(String(s.email.pass).trim()),
        fromEmail: s.email.fromEmail,
        fromName: s.email.fromName,
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

  async updateNotifySettings(patch: {
    smsEnabled?: boolean;
    smsRegion?: string;
    smsAccessKeyId?: string;
    smsAccessKeySecret?: string;
    smsSignName?: string;
    smsTemplateCode?: string;
    smsCodeTtlSeconds?: number;
    emailEnabled?: boolean;
    emailHost?: string;
    emailPort?: number;
    emailSecure?: boolean;
    emailUser?: string;
    emailPass?: string;
    emailFromEmail?: string;
    emailFromName?: string;
  }): Promise<NotifySettingsForAdmin> {
    const current = await this.prisma.systemSetting.findUnique({
      where: { key: 'NOTIFY' },
      select: { value: true },
    });
    const raw = asRecord(current?.value);
    const next: Record<string, unknown> = { ...raw };

    const sms = { ...asRecord(next['sms']) };
    sms['provider'] = 'ALIYUN';
    if (typeof patch.smsEnabled === 'boolean')
      sms['enabled'] = patch.smsEnabled;
    if (typeof patch.smsRegion === 'string')
      sms['region'] = patch.smsRegion.trim();
    if (typeof patch.smsAccessKeyId === 'string')
      sms['accessKeyId'] = patch.smsAccessKeyId.trim();
    if (typeof patch.smsSignName === 'string')
      sms['signName'] = patch.smsSignName.trim();
    if (typeof patch.smsTemplateCode === 'string')
      sms['templateCode'] = patch.smsTemplateCode.trim();
    if (typeof patch.smsCodeTtlSeconds === 'number')
      sms['codeTtlSeconds'] = Math.trunc(patch.smsCodeTtlSeconds);
    if (typeof patch.smsAccessKeySecret === 'string') {
      const v = patch.smsAccessKeySecret.trim();
      if (v) sms['accessKeySecret'] = v;
    }
    next['sms'] = sms;

    const email = { ...asRecord(next['email']) };
    email['provider'] = 'SMTP';
    if (typeof patch.emailEnabled === 'boolean')
      email['enabled'] = patch.emailEnabled;
    if (typeof patch.emailHost === 'string')
      email['host'] = patch.emailHost.trim();
    if (typeof patch.emailPort === 'number')
      email['port'] = Math.trunc(patch.emailPort);
    if (typeof patch.emailSecure === 'boolean')
      email['secure'] = patch.emailSecure;
    if (typeof patch.emailUser === 'string')
      email['user'] = patch.emailUser.trim();
    if (typeof patch.emailFromEmail === 'string')
      email['fromEmail'] = patch.emailFromEmail.trim();
    if (typeof patch.emailFromName === 'string')
      email['fromName'] = patch.emailFromName.trim();
    if (typeof patch.emailPass === 'string') {
      const v = patch.emailPass.trim();
      if (v) email['pass'] = v;
    }
    next['email'] = email;

    await this.upsertSetting('NOTIFY', next as Prisma.InputJsonValue);
    return this.getNotifySettingsForAdmin();
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

export type {
  PaymentSdkSettings,
  PaymentSettingsForAdmin,
  SiteSettings,
  NotifySettings,
  NotifySettingsForAdmin,
};
