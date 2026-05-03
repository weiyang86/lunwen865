import { Module } from '@nestjs/common';

import { ServicePackageController } from './service-package.controller';
import { ServicePackageService } from './service-package.service';

// TODO(ORD-2): 将 ServicePackageModule 挂载到 AppModule，并补齐端点与持久化层
@Module({
  controllers: [ServicePackageController],
  providers: [ServicePackageService],
})
export class ServicePackageModule {}
