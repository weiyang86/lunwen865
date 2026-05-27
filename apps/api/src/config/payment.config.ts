import { registerAs } from '@nestjs/config';

function pickEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

export default registerAs('payment', () => ({
  wechat: {
    appid: pickEnv('WECHAT_PAY_APP_ID'),
    mchid: pickEnv('WECHAT_PAY_MCH_ID'),
    serialNo: pickEnv('WECHAT_PAY_CERT_SERIAL_NO'),
    privateKeyPath: pickEnv('WECHAT_PAY_PRIVATE_KEY_PATH', 'WECHAT_PAY_PRIVATE_KEY'),
    apiV3Key: pickEnv('WECHAT_PAY_API_V3_KEY'),
    publicKeyPath: pickEnv('WECHAT_PAY_PUBLIC_KEY_PATH', 'WECHAT_PAY_PUBLIC_KEY'),
    platformCertPath: pickEnv(
      'WECHAT_PAY_PLATFORM_CERT_PATH',
      'WECHAT_PAY_PLATFORM_CERT',
    ),
    notifyUrl: pickEnv('WECHAT_PAY_NOTIFY_URL'),
  },
  alipay: {
    appId: pickEnv('ALIPAY_APP_ID'),
    privateKeyPath: pickEnv('ALIPAY_PRIVATE_KEY_PATH', 'ALIPAY_PRIVATE_KEY'),
    publicKeyPath: pickEnv('ALIPAY_PUBLIC_KEY_PATH', 'ALIPAY_PUBLIC_KEY'),
    gateway:
      pickEnv('ALIPAY_GATEWAY') || 'https://openapi.alipay.com/gateway.do',
    notifyUrl: pickEnv('ALIPAY_NOTIFY_URL'),
    returnUrl: pickEnv('ALIPAY_RETURN_URL'),
    sellerId: pickEnv('ALIPAY_SELLER_ID'),
  },
  orderExpireMinutes: Number(process.env.ORDER_EXPIRE_MINUTES ?? 30),
  sandbox: (process.env.PAYMENT_SANDBOX ?? 'true') === 'true',
  registerGift: {
    paperGeneration: Number(process.env.REGISTER_GIFT_PAPER_GENERATION ?? 1),
    polish: Number(process.env.REGISTER_GIFT_POLISH ?? 2),
    export: Number(process.env.REGISTER_GIFT_EXPORT ?? 1),
  },
}));
