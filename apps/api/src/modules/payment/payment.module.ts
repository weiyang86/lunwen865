import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OrderModule } from '../order/order.module';
import { QuotaModule } from '../quota/quota.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminPaymentController } from './admin-payment.controller';
import { NotifyController } from './notify.controller';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { AlipayProvider } from './providers/alipay.provider';
import { WechatPayProvider } from './providers/wechat-pay.provider';
import { MockPayAdapter } from './providers/mock-pay.adapter';
import { ReconcileService } from './reconcile.service';
import { PaymentCallbackService } from './payment-callback.service';

@Module({
  imports: [PrismaModule, OrderModule, QuotaModule, SettingsModule],
  controllers: [PaymentController, NotifyController, AdminPaymentController],
  providers: [
    PaymentService,
    WechatPayProvider,
    AlipayProvider,
    ReconcileService,
    MockPayAdapter,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
