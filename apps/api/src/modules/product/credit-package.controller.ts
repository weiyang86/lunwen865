import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ProductService } from './product.service';

@Controller('credit-packages')
@Public()
export class CreditPackageController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll() {
    return this.productService.findActive();
  }
}
