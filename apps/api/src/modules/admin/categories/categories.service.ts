import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CategoryReorderDto } from './dto/category-reorder.dto';
import { CategoryUpsertDto } from './dto/category-upsert.dto';

type CategoryNode = {
  id: string;
  parentId: string | null;
  name: string;
  sort: number;
  iconUrl: string | null;
  productCount: number;
  children?: CategoryNode[];
};

type ProductCountGroup = {
  categoryId: string | null;
  _count: { _all: number };
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async tree(): Promise<CategoryNode[]> {
    const [cats, counts] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where: { deletedAt: null },
        orderBy: [{ parentId: 'asc' }, { sort: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.product.groupBy({
        by: ['categoryId'],
        where: { deletedAt: null, categoryId: { not: null } },
        _count: { _all: true },
        orderBy: { categoryId: 'asc' },
      }),
    ]);

    const countMap = new Map<string, number>();
    for (const c of counts as ProductCountGroup[]) {
      if (!c.categoryId) continue;
      countMap.set(String(c.categoryId), Number(c._count._all ?? 0));
    }

    const nodeMap = new Map<string, CategoryNode>();
    for (const c of cats) {
      nodeMap.set(c.id, {
        id: c.id,
        parentId: c.parentId,
        name: c.name,
        sort: c.sort,
        iconUrl: c.iconUrl,
        productCount: countMap.get(c.id) ?? 0,
        children: [],
      });
    }

    const roots: CategoryNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async create(dto: CategoryUpsertDto) {
    const parentId = dto.parentId ?? null;
    const depth = await this.getDepth(parentId);
    if (depth >= 3) throw new BadRequestException('分类层级最多 3 层');

    try {
      return await this.prisma.category.create({
        data: {
          parentId,
          name: dto.name.trim(),
          iconUrl: dto.iconUrl?.trim() || null,
          sort: 0,
          deletedAt: null,
        },
      });
    } catch (e: unknown) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException('同级分类名称已存在');
      }
      throw e;
    }
  }

  async update(id: string, dto: CategoryUpsertDto) {
    const current = await this.prisma.category.findUnique({ where: { id } });
    if (!current || current.deletedAt)
      throw new NotFoundException('分类不存在');

    if ((dto.parentId ?? current.parentId) !== current.parentId) {
      throw new BadRequestException('本段不支持调整分类层级');
    }

    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          iconUrl: dto.iconUrl?.trim() || null,
        },
      });
    } catch (e: unknown) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException('同级分类名称已存在');
      }
      throw e;
    }
  }

  async remove(id: string) {
    const current = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!current || current.deletedAt)
      throw new NotFoundException('分类不存在');

    const childCount = await this.prisma.category.count({
      where: { parentId: id, deletedAt: null },
    });
    if (childCount > 0) throw new BadRequestException('请先删除/移除子分类');

    const ids = await this.getDescendantIdsIncludingSelf(id);
    const productCount = await this.prisma.product.count({
      where: { deletedAt: null, categoryId: { in: ids } },
    });
    if (productCount > 0) {
      throw new ConflictException(
        `分类下仍有 ${productCount} 个商品，无法删除`,
      );
    }

    await this.prisma.category.delete({ where: { id } });
    return { id };
  }

  async reorder(dto: CategoryReorderDto) {
    const parentId = dto.parentId ?? null;
    const siblings = await this.prisma.category.findMany({
      where: { parentId, deletedAt: null },
      select: { id: true },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
    const siblingIds = new Set(siblings.map((s) => s.id));
    if (dto.orderedIds.length !== siblings.length) {
      throw new BadRequestException('重排列表数量不匹配');
    }
    for (const id of dto.orderedIds) {
      if (!siblingIds.has(id))
        throw new BadRequestException('重排列表包含非法 id');
    }

    await this.prisma.$transaction(
      dto.orderedIds.map((id, idx) =>
        this.prisma.category.update({ where: { id }, data: { sort: idx } }),
      ),
    );

    return { ok: true as const };
  }

  private async getDepth(parentId: string | null) {
    if (!parentId) return 0;
    let depth = 1;
    let cur: string | null = parentId;
    while (cur) {
      const raw: unknown = await this.prisma.category.findUnique({
        where: { id: cur },
        select: { parentId: true, deletedAt: true },
      });
      if (!isRecord(raw) || raw['deletedAt'])
        throw new NotFoundException('父分类不存在');
      const nextParentId = raw['parentId'];
      cur = typeof nextParentId === 'string' ? nextParentId : null;
      if (cur) depth += 1;
      if (depth > 3) break;
    }
    return depth;
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
