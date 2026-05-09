import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderSourceType,
  OrderStatus,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAgencyOrderDto } from './dto/create-agency-order.dto';
import { QueryAgencyOrderDto } from './dto/query-agency-order.dto';
import { generateOrderNo } from './utils/order-no.util';

@Injectable()
export class AgencyOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(
    _operatorId: string,
    dto: CreateAgencyOrderDto,
    clientIp?: string,
  ) {
    const [user, product] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.userId } }),
      this.prisma.product.findUnique({ where: { id: dto.productId } }),
    ]);

    if (!user) throw new NotFoundException('学生用户不存在');
    if (!product) throw new NotFoundException('商品不存在');
    if (product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException('该商品已下架');
    }

    const expireMinutes = this.config.get<number>(
      'payment.orderExpireMinutes',
      30,
    );
    const expiresAt = dayjs().add(expireMinutes, 'minute').toDate();

    const productSnapshot: Prisma.InputJsonValue = {
      id: product.id,
      code: product.code,
      name: product.name,
      description: product.description,
      priceCents: product.priceCents,
      originalPriceCents: product.originalPriceCents,
      paperQuota: product.paperQuota,
      polishQuota: product.polishQuota,
      exportQuota: product.exportQuota,
      aiChatQuota: product.aiChatQuota,
      status: product.status,
      sortOrder: product.sortOrder,
    };

    return this.prisma.order.create({
      data: {
        orderNo: generateOrderNo(),
        userId: dto.userId,
        productId: product.id,
        productSnapshot,
        amountCents: product.priceCents,
        status: OrderStatus.PENDING,
        sourceType: OrderSourceType.AGENCY,
        agencyId: dto.agencyId,
        expiresAt,
        clientIp: clientIp ?? null,
        remark: dto.remark ?? null,
      },
      include: {
        product: true,
      },
    });
  }

  async findAll(_operatorId: string, query: QueryAgencyOrderDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.OrderWhereInput = {
      sourceType: OrderSourceType.AGENCY,
      agencyId: query.agencyId,
    };

    if (query.status) where.status = query.status;
    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
