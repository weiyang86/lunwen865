import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async findActive() {
    return this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findAll(includeInactive = false) {
    return this.prisma.product.findMany({
      where: includeInactive
        ? { deletedAt: null }
        : { status: ProductStatus.ACTIVE, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('商品不存在');
    return p;
  }

  async create(dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description ?? null,
          priceCents: dto.priceCents,
          originalPriceCents: dto.originalPriceCents ?? null,
          paperQuota: dto.paperQuota ?? 0,
          polishQuota: dto.polishQuota ?? 0,
          exportQuota: dto.exportQuota ?? 0,
          aiChatQuota: dto.aiChatQuota ?? 0,
          sortOrder: dto.sortOrder ?? 0,
          status: ProductStatus.ACTIVE,
        },
      });
    } catch (e: unknown) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException('商品 code 已存在');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    try {
      return await this.prisma.product.update({
        where: { id },
        data: {
          code: dto.code ?? undefined,
          name: dto.name ?? undefined,
          description: dto.description ?? undefined,
          priceCents: dto.priceCents ?? undefined,
          originalPriceCents: dto.originalPriceCents ?? undefined,
          paperQuota: dto.paperQuota ?? undefined,
          polishQuota: dto.polishQuota ?? undefined,
          exportQuota: dto.exportQuota ?? undefined,
          aiChatQuota: dto.aiChatQuota ?? undefined,
          sortOrder: dto.sortOrder ?? undefined,
        },
      });
    } catch (e: unknown) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException('商品 code 已存在');
      }
      throw e;
    }
  }

  async toggleStatus(id: string, status: ProductStatus) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProductStatus.INACTIVE },
    });
    return { id };
  }

  async listAdmin(params: {
    page: number;
    pageSize: number;
    categoryIds?: string[];
    keyword?: string;
    status?: ProductStatus[];
  }) {
    const where: Prisma.ProductWhereInput = { deletedAt: null };
    if (params.categoryIds?.length)
      where.categoryId = { in: params.categoryIds };
    if (params.keyword?.trim()) {
      const k = params.keyword.trim();
      where.OR = [{ name: { contains: k } }, { code: { contains: k } }];
    }
    if (params.status?.length) where.status = { in: params.status };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { category: true },
      }),
    ]);

    return { list, total, page: params.page, pageSize: params.pageSize };
  }

  async adminBatchUpdateStatus(ids: string[], status: ProductStatus) {
    const r = await this.prisma.product.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { status },
    });
    return { updated: r.count };
  }

  async adminBatchRemove(ids: string[]) {
    const r = await this.prisma.product.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), status: ProductStatus.INACTIVE },
    });
    return { removed: r.count };
  }
}
