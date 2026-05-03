import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StoreStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListStoresDto } from './dto/list-stores.dto';
import { UpsertStoreDto } from './dto/upsert-store.dto';
import { UpdateStoreStatusDto } from './dto/update-store-status.dto';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: ListStoresDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const where: Prisma.StoreWhereInput = {};

    if (dto.status && dto.status !== 'ALL') {
      where.status = dto.status;
    } else {
      where.status = { in: [StoreStatus.OPEN, StoreStatus.PAUSED] };
    }

    if (dto.keyword?.trim()) {
      const k = dto.keyword.trim();
      where.OR = [{ name: { contains: k } }, { address: { contains: k } }];
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.store.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.store.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  async detail(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('门店不存在');
    return store;
  }

  async create(dto: UpsertStoreDto) {
    const exists = await this.prisma.store.findUnique({
      where: { code: dto.code },
    });
    if (exists) throw new BadRequestException('门店编码已存在');

    return this.prisma.store.create({
      data: {
        name: dto.name,
        code: dto.code,
        phone: dto.phone ?? null,
        address: dto.address,
        longitude: dto.longitude ?? null,
        latitude: dto.latitude ?? null,
        businessHours: dto.businessHours as Prisma.InputJsonValue,
        description: dto.description ?? null,
        managerName: dto.managerName ?? null,
        managerPhone: dto.managerPhone ?? null,
        status: StoreStatus.OPEN,
        deletedAt: null,
      },
    });
  }

  async update(id: string, dto: UpsertStoreDto) {
    const store = await this.detail(id);
    if (dto.code !== store.code)
      throw new BadRequestException('门店编码不可修改');

    return this.prisma.store.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone ?? null,
        address: dto.address,
        longitude: dto.longitude ?? null,
        latitude: dto.latitude ?? null,
        businessHours: dto.businessHours as Prisma.InputJsonValue,
        description: dto.description ?? null,
        managerName: dto.managerName ?? null,
        managerPhone: dto.managerPhone ?? null,
      },
    });
  }

  async updateStatus(id: string, dto: UpdateStoreStatusDto) {
    const store = await this.detail(id);
    if (store.status === StoreStatus.CLOSED)
      throw new BadRequestException('门店已关闭');

    return this.prisma.store.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async remove(id: string) {
    await this.detail(id);
    await this.prisma.store.update({
      where: { id },
      data: {
        status: StoreStatus.CLOSED,
        deletedAt: new Date(),
      },
    });
    return { id };
  }
}
