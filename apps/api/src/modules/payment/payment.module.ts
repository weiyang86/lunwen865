import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OrderModule } from '../order/order.module';
import { QuotaModule } from '../quota/quota.module';
import { AdminPaymentController } from './admin-payment.controller';
import { NotifyController } from './notify.controller';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { AlipayProvider } from './providers/alipay.provider';
import { WechatPayProvider } from './providers/wechat-pay.provider';
import { ReconcileService } from './reconcile.service';

@Module({
  imports: [PrismaModule, OrderModule, QuotaModule],
  controllers: [PaymentController, NotifyController, AdminPaymentController],
  providers: [
    PaymentService,
    WechatPayProvider,
    AlipayProvider,
    ReconcileService,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
