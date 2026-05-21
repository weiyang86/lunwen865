import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => ({
  wechat: {
    appid: process.env.WECHAT_PAY_APP_ID ?? '',
    mchid: process.env.WECHAT_PAY_MCH_ID ?? '',
    serialNo: process.env.WECHAT_PAY_CERT_SERIAL_NO ?? '',
    privateKeyPath: process.env.WECHAT_PAY_PRIVATE_KEY ?? '',
    apiV3Key: process.env.WECHAT_PAY_API_V3_KEY ?? '',
    publicKey: process.env.WECHAT_PAY_PUBLIC_KEY ?? '',
    platformCert: process.env.WECHAT_PAY_PLATFORM_CERT ?? '',
    notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL ?? '',
  },
  alipay: {
    appId: process.env.ALIPAY_APPID ?? '',
    privateKeyPath:
      process.env.ALIPAY_PRIVATE_KEY_PATH ??
      './certs/alipay/app_private_key.pem',
    publicKeyPath:
      process.env.ALIPAY_PUBLIC_KEY_PATH ??
      './certs/alipay/alipay_public_key.pem',
    gateway:
      process.env.ALIPAY_GATEWAY ?? 'https://openapi.alipay.com/gateway.do',
    notifyUrl: process.env.ALIPAY_NOTIFY_URL ?? '',
    returnUrl: process.env.ALIPAY_RETURN_URL ?? '',
  },
  orderExpireMinutes: Number(process.env.ORDER_EXPIRE_MINUTES ?? 30),
  sandbox: (process.env.PAYMENT_SANDBOX ?? 'true') === 'true',
  registerGift: {
    paperGeneration: Number(process.env.REGISTER_GIFT_PAPER_GENERATION ?? 1),
    polish: Number(process.env.REGISTER_GIFT_POLISH ?? 2),
    export: Number(process.env.REGISTER_GIFT_EXPORT ?? 1),
  },
}));
