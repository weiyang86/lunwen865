import { BadRequestException } from '@nestjs/common';
import { AlipayProvider } from './alipay.provider';
import type { SettingsService } from '../../settings/settings.service';

type AlipaySdkMockBag = {
  exec: jest.Mock;
  checkNotifySign: jest.Mock;
  ctor: jest.Mock;
};

jest.mock('alipay-sdk', () => {
  const bag: AlipaySdkMockBag = {
    exec: jest.fn(),
    checkNotifySign: jest.fn(),
    ctor: jest.fn(),
  };
  bag.ctor.mockImplementation(() => ({
    exec: bag.exec,
    checkNotifySign: bag.checkNotifySign,
  }));
  (
    globalThis as unknown as { __ALIPAY_SDK_MOCKS__: AlipaySdkMockBag }
  ).__ALIPAY_SDK_MOCKS__ = bag;
  return {
    __esModule: true,
    default: bag.ctor,
  };
});

const sdkMocks = () =>
  (globalThis as unknown as { __ALIPAY_SDK_MOCKS__: AlipaySdkMockBag })
    .__ALIPAY_SDK_MOCKS__;

const PRIVATE_KEY =
  '-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----';
const PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nFAKE\n-----END PUBLIC KEY-----';

function createSettings(overrides: Record<string, unknown> = {}) {
  return {
    getPaymentSettings: jest.fn().mockResolvedValue({
      sandbox: true,
      orderExpireMinutes: 30,
      wechat: {},
      alipay: {
        appId: 'app_1',
        gateway: 'https://openapi.alipay.com/gateway.do',
        privateKeyPath: PRIVATE_KEY,
        publicKeyPath: PUBLIC_KEY,
        notifyUrl: 'https://example.com/api/payments/alipay/notify',
        returnUrl: 'https://example.com/payments/result',
        sellerId: 'seller_1',
        signType: 'RSA2',
        charset: 'utf-8',
        ...overrides,
      },
    }),
  } as unknown as SettingsService;
}

describe('AlipayProvider', () => {
  beforeEach(() => {
    sdkMocks().exec.mockReset();
    sdkMocks().checkNotifySign.mockReset();
    sdkMocks().ctor.mockClear();
  });

  it('pagePay uses alipay.trade.page.pay and never returns mock-page-pay', async () => {
    sdkMocks().exec.mockResolvedValue(
      'https://openapi.alipay.com/gateway.do?method=alipay.trade.page.pay&sign=abc',
    );
    const provider = new AlipayProvider(createSettings());

    const result = await provider.pagePay({
      outTradeNo: 'PAY1',
      subject: '套餐',
      totalAmountCents: 1,
      notifyUrl: 'https://example.com/api/payments/alipay/notify',
      returnUrl: 'https://example.com/payments/result?orderId=o1',
    });

    const pageCall = sdkMocks().exec.mock.calls[0] as [
      string,
      { notify_url: string; bizContent: Record<string, unknown> },
      { method: string },
    ];
    expect(pageCall[0]).toBe('alipay.trade.page.pay');
    expect(pageCall[1].notify_url).toBe(
      'https://example.com/api/payments/alipay/notify',
    );
    expect(pageCall[1].bizContent).toMatchObject({
      out_trade_no: 'PAY1',
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: '0.01',
    });
    expect(pageCall[2]).toEqual({ method: 'GET' });
    expect(result.paymentUrl).toContain('alipay.trade.page.pay');
    expect(result.paymentUrl).not.toContain('mock-page-pay');
  });

  it('wapPay uses alipay.trade.wap.pay', async () => {
    sdkMocks().exec.mockResolvedValue(
      'https://openapi.alipay.com/gateway.do?method=alipay.trade.wap.pay&sign=abc',
    );
    const provider = new AlipayProvider(createSettings());

    const result = await provider.wapPay({
      outTradeNo: 'PAY2',
      subject: '套餐',
      totalAmountCents: 100,
      notifyUrl: 'https://example.com/api/payments/alipay/notify',
      returnUrl: 'https://example.com/payments/result?orderId=o2',
    });

    const wapCall = sdkMocks().exec.mock.calls[0] as [
      string,
      { bizContent: Record<string, unknown> },
      { method: string },
    ];
    expect(wapCall[0]).toBe('alipay.trade.wap.pay');
    expect(wapCall[1].bizContent).toMatchObject({
      out_trade_no: 'PAY2',
      product_code: 'QUICK_WAP_WAY',
      total_amount: '1.00',
    });
    expect(wapCall[2]).toEqual({ method: 'GET' });
    expect(result.paymentUrl).toContain('alipay.trade.wap.pay');
  });

  it('throws a clear error when required config is missing', async () => {
    const provider = new AlipayProvider(createSettings({ appId: '' }));

    await expect(
      provider.pagePay({
        outTradeNo: 'PAY3',
        subject: '套餐',
        totalAmountCents: 100,
        notifyUrl: 'https://example.com/api/payments/alipay/notify',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('verifyAndNormalizeNotify rejects invalid signature before settlement data is trusted', async () => {
    sdkMocks().checkNotifySign.mockReturnValue(false);
    const provider = new AlipayProvider(createSettings());

    await expect(
      provider.verifyAndNormalizeNotify({
        app_id: 'app_1',
        seller_id: 'seller_1',
        out_trade_no: 'PAY4',
        trade_no: 'TRADE4',
        total_amount: '1.00',
        trade_status: 'TRADE_SUCCESS',
      }),
    ).rejects.toThrow('支付宝异步通知验签失败');
  });

  it('queryPayment normalizes successful trade status and yuan amount', async () => {
    sdkMocks().exec.mockResolvedValue({
      alipay_trade_query_response: {
        out_trade_no: 'PAY5',
        trade_no: 'TRADE5',
        total_amount: '12.34',
        trade_status: 'TRADE_FINISHED',
        send_pay_date: '2026-06-02 09:21:05',
      },
    });
    const provider = new AlipayProvider(createSettings());

    const result = await provider.queryPayment('PAY5');

    expect(sdkMocks().exec).toHaveBeenCalledWith('alipay.trade.query', {
      bizContent: { out_trade_no: 'PAY5' },
    });
    expect(result).toMatchObject({
      channel: 'alipay',
      providerOrderNo: 'PAY5',
      providerTradeNo: 'TRADE5',
      amount: 1234,
      tradeStatus: 'TRADE_FINISHED',
      success: true,
    });
  });
});
