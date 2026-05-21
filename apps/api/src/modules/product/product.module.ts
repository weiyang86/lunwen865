import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminProductController } from './admin-product.controller';
import { CreditPackageController } from './credit-package.controller';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ProductController,
    CreditPackageController,
    AdminProductController,
  ],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
