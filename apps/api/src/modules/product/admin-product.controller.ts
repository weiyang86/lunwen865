import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductStatus, UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminListProductsDto } from './dto/admin-list-products.dto';
import { AdminUpdateProductStatusDto } from './dto/admin-update-product-status.dto';
import { AdminBatchStatusDto } from './dto/admin-batch-status.dto';
import { AdminBatchRemoveDto } from './dto/admin-batch-remove.dto';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@Query() q: AdminListProductsDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;

    let categoryIds: string[] | undefined;
    if (q.categoryId) {
      categoryIds = q.includeSubCategory
        ? await this.getDescendantIdsIncludingSelf(q.categoryId)
        : [q.categoryId];
    }

    const status =
      q.status === 'ALL' ? undefined : [this.mapApiStatusToDb(q.status)];
    const r = await this.productService.listAdmin({
      page,
      pageSize,
      categoryIds,
      keyword: q.keyword,
      status,
    });

    return {
      list: r.list.map((p) => ({
        id: p.id,
        name: p.name,
        categoryId: p.categoryId ?? '',
        categoryName: p.category?.name ?? '未分类',
        coverUrl: p.coverUrl ?? null,
        status: this.mapDbStatusToApi(p.status),
        minPrice: p.priceCents,
        maxPrice: p.priceCents,
        totalStock: p.totalStock,
        soldCount: p.soldCount,
        updatedAt: p.updatedAt,
      })),
      total: r.total,
      page: r.page,
      pageSize: r.pageSize,
    };
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.update(id, dto);
  }

  @Patch(':id/status')
  async toggleStatus(
    @Param('id') id: string,
    @Body() dto: AdminUpdateProductStatusDto,
  ) {
    const status =
      dto.status === 'ON_SALE' ? ProductStatus.ACTIVE : ProductStatus.INACTIVE;
    const p = await this.productService.toggleStatus(id, status);
    return { id: p.id, status: this.mapDbStatusToApi(p.status) };
  }

  @Post('batch-status')
  batchUpdateStatus(@Body() dto: AdminBatchStatusDto) {
    const status =
      dto.status === 'ON_SALE' ? ProductStatus.ACTIVE : ProductStatus.INACTIVE;
    return this.productService.adminBatchUpdateStatus(dto.ids, status);
  }

  @Post('batch-remove')
  batchRemove(@Body() dto: AdminBatchRemoveDto) {
    return this.productService.adminBatchRemove(dto.ids);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }

  private mapDbStatusToApi(
    s: ProductStatus,
  ): 'ON_SALE' | 'OFF_SHELF' | 'DRAFT' {
    if (s === ProductStatus.ACTIVE) return 'ON_SALE';
    if (s === ProductStatus.DRAFT) return 'DRAFT';
    return 'OFF_SHELF';
  }

  private mapApiStatusToDb(
    s: 'ON_SALE' | 'OFF_SHELF' | 'DRAFT',
  ): ProductStatus {
    if (s === 'ON_SALE') return ProductStatus.ACTIVE;
    if (s === 'DRAFT') return ProductStatus.DRAFT;
    return ProductStatus.INACTIVE;
  }

  private async getDescendantIdsIncludingSelf(
    rootId: string,
  ): Promise<string[]> {
    const cats = await this.prisma.category.findMany({
      where: { deletedAt: null },
      select: { id: true, parentId: true },
    });
    const childrenMap = new Map<string, string[]>();
    for (const c of cats) {
      if (!c.parentId) continue;
      if (!childrenMap.has(c.parentId)) childrenMap.set(c.parentId, []);
      childrenMap.get(c.parentId)!.push(c.id);
    }
    const ids: string[] = [];
    const q: string[] = [rootId];
    while (q.length) {
      const id = q.shift()!;
      ids.push(id);
      const children = childrenMap.get(id) ?? [];
      for (const child of children) q.push(child);
    }
    return ids;
  }
}
