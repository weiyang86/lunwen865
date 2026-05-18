import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ProductStatus, UserRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
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
import type { Request } from 'express';
import { UploadedFile } from '@nestjs/common';

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

  @Get(':id')
  async detail(@Param('id') id: string) {
    const p = await this.productService.findOne(id);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description ?? '',
      coverUrl: p.coverUrl ?? null,
      priceCents: p.priceCents,
      originalPriceCents: p.originalPriceCents ?? null,
      brainCellAmount: p.brainCellAmount,
      paperQuota: p.paperQuota,
      polishQuota: p.polishQuota,
      exportQuota: p.exportQuota,
      aiChatQuota: p.aiChatQuota,
      sortOrder: p.sortOrder,
      status: this.mapDbStatusToApi(p.status),
      categoryId: p.categoryId ?? null,
      totalStock: p.totalStock,
      soldCount: p.soldCount,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
    };
  }

  @Post('upload-cover')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype?.startsWith('image/')) {
          cb(new BadRequestException('只支持图片文件'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadCover(
    @UploadedFile()
    file:
      | {
          originalname?: string;
          mimetype?: string;
          buffer?: Buffer;
        }
      | undefined,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('未收到文件');
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('只支持图片文件');
    }
    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('文件内容为空');
    }

    const dir = path.join(process.cwd(), 'uploads', 'product-covers');
    await fs.promises.mkdir(dir, { recursive: true });

    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const safeExt = ext.length <= 10 ? ext : '.png';
    const filename = `${Date.now()}_${crypto.randomUUID()}${safeExt}`;
    const filePath = path.join(dir, filename);
    await fs.promises.writeFile(filePath, file.buffer);

    const origin = `${req.protocol}://${req.get('host')}`;
    const urlPath = `/uploads/product-covers/${filename}`;
    return { url: `${origin}${urlPath}` };
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
