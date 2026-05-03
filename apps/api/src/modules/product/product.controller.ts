import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { ProductService } from './product.service';

@Controller('products')
@Public()
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll() {
    return this.productService.findActive();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const p = await this.productService.findOne(id);
    if (p.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException('该商品已下架');
    }
    return p;
  }
}
