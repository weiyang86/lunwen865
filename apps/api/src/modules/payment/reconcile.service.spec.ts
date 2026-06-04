import type { PrismaService } from '../../prisma/prisma.service';
import type { OrderService } from '../order/order.service';
import { ReconcileService } from './reconcile.service';
import type { AlipayProvider } from './providers/alipay.provider';
import type { WechatPayProvider } from './providers/wechat-pay.provider';

describe('ReconcileService', () => {
  it('漏单补偿：provider.query 返回 PAID -> 调用统一 PaymentCallbackService', async () => {
    const prisma = {
      order: {
        findMany: jest.fn(() =>
          Promise.resolve([
            {
              id: 'o1',
              orderNo: 'PAY_1',
              status: 'PENDING',
              outTradeNo: 'PAY_1',
              channel: 'WECHAT',
              method: 'WECHAT_NATIVE',
            },
          ]),
        ),
      },
    } as unknown as PrismaService;

    const queryMock = jest.fn(() =>
      Promise.resolve({
        status: 'PAID',
        transactionId: 'TX_1',
        paidAmountCents: 1990,
        paidAt: new Date(),
      }),
    );
    const wechat = { query: queryMock } as unknown as WechatPayProvider;

    const alipay = {
      query: jest.fn(() => Promise.resolve({ status: 'PENDING' })),
    } as unknown as AlipayProvider;

    const orderService = {} as unknown as OrderService;

    const processMock = jest.fn(() => Promise.resolve({ processed: true }));
    const callbackService = {
      process: processMock,
    } as never;
    const service = new ReconcileService(
      prisma,
      wechat,
      alipay,
      orderService,
      callbackService,
    );
    await service.reconcilePending();

    expect(queryMock).toHaveBeenCalledWith('PAY_1');
    expect(processMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'wechat',
        providerOrderNo: 'PAY_1',
        providerTradeNo: 'TX_1',
        amount: 1990,
        success: true,
      }),
    );
  });
});
