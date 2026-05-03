import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  Prisma,
  RefundStatus,
  TaskAdminAction,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { generateRefundNo } from '../../order/utils/order-no.util';
import { CreateRefundDto } from './dto/create-refund.dto';
import type { ListOrdersDto, OrderStatusLiteral } from './dto/list-orders.dto';
import { ResolveRefundDto } from './dto/resolve-refund.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

function toApiOrderStatus(s: OrderStatus): OrderStatusLiteral {
  if (s === OrderStatus.PENDING || s === OrderStatus.PENDING_PAYMENT)
    return 'PENDING_PAYMENT';
  if (s === OrderStatus.PAID) return 'PAID';
  if (s === OrderStatus.FULFILLING) return 'FULFILLING';
  if (s === OrderStatus.COMPLETED) return 'COMPLETED';
  if (s === OrderStatus.CANCELLED || s === OrderStatus.CLOSED)
    return 'CANCELLED';
  if (s === OrderStatus.REFUNDING) return 'REFUNDING';
  return 'REFUNDED';
}

function toWhereStatus(
  s: OrderStatusLiteral,
): Prisma.OrderWhereInput['status'] {
  if (s === 'PENDING_PAYMENT')
    return { in: [OrderStatus.PENDING, OrderStatus.PENDING_PAYMENT] };
  if (s === 'CANCELLED')
    return { in: [OrderStatus.CANCELLED, OrderStatus.CLOSED] };
  return s;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: ListOrdersDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const where: Prisma.OrderWhereInput = {};

    // ORD-3: linked from Task via Order.taskId
    // ORD-5: tutor system
    // tutorId is deprecated; use primaryTutorId as the single source of truth

    if (dto.status && dto.status !== 'ALL') {
      where.status = toWhereStatus(dto.status);
    }

    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate)
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(
          dto.startDate,
        );
      if (dto.endDate)
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(dto.endDate);
    }

    if (dto.keyword?.trim()) {
      const k = dto.keyword.trim();
      where.OR = [
        { orderNo: { contains: k } },
        { user: { phone: { contains: k } } },
        { user: { nickname: { contains: k } } },
      ];
    }

    const taskWhere: Prisma.TaskWhereInput = {};
    if (dto.currentStage) {
      taskWhere.currentStage = dto.currentStage;
    }
    if (dto.dueDateBefore) {
      taskWhere.deadline = { lte: new Date(dto.dueDateBefore) };
    }
    if (Object.keys(taskWhere).length > 0) {
      where.task = taskWhere;
    }

    const tutorFilterId =
      dto.primaryTutorId?.trim() || dto.tutorId?.trim() || null;
    if (tutorFilterId) {
      where.primaryTutorId = tutorFilterId;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          orderNo: true,
          status: true,
          amountCents: true,
          paidAmountCents: true,
          discountCents: true,
          createdAt: true,
          paidAt: true,
          primaryTutorId: true,
          primaryTutor: {
            select: { id: true, nickname: true, email: true },
          },
          user: { select: { id: true, phone: true, nickname: true } },
          _count: { select: { items: true } },
          task: {
            select: {
              id: true,
              title: true,
              educationLevel: true,
              currentStage: true,
              deadline: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        status: toApiOrderStatus(o.status),
        totalAmount: o.amountCents,
        payAmount: o.paidAmountCents ?? o.amountCents,
        discount: o.discountCents,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
        user: o.user,
        _count: o._count,
        thesis: o.task
          ? {
              title: o.task.title ?? undefined,
              educationLevel: o.task.educationLevel,
            }
          : null,
        currentStage: o.task?.currentStage ?? null,
        dueDate: o.task?.deadline?.toISOString() ?? null,
        primaryTutorId: o.primaryTutorId ?? null,
        primaryTutor: o.primaryTutor
          ? {
              id: o.primaryTutor.id,
              name:
                o.primaryTutor.nickname ??
                o.primaryTutor.email ??
                o.primaryTutor.id,
              email: o.primaryTutor.email ?? null,
            }
          : null,
        taskId: o.task?.id ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async detail(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, phone: true, nickname: true, avatar: true },
        },
        primaryTutor: {
          select: { id: true, nickname: true, email: true },
        },
        items: true,
        refunds: { orderBy: { createdAt: 'desc' } },
        task: {
          select: {
            id: true,
            userId: true,
            status: true,
            title: true,
            educationLevel: true,
            currentStage: true,
            requirements: true,
            totalWordCount: true,
            deadline: true,
            completedAt: true,
            createdAt: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('订单不存在');
    // ORD-3: linked from Task via Order.taskId
    return {
      ...order,
      thesis: order.task
        ? {
            title: order.task.title ?? undefined,
            educationLevel: order.task.educationLevel,
          }
        : null,
      currentStage: order.task?.currentStage ?? null,
      dueDate: order.task?.deadline?.toISOString() ?? null,
      primaryTutorId: order.primaryTutorId ?? null,
      primaryTutor: order.primaryTutor
        ? {
            id: order.primaryTutor.id,
            name:
              order.primaryTutor.nickname ??
              order.primaryTutor.email ??
              order.primaryTutor.id,
            email: order.primaryTutor.email ?? null,
          }
        : null,
      taskId: order.task?.id ?? null,
    };
  }

  async assignTutor(orderId: string, primaryTutorId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('订单不存在');

    const tutor = await this.prisma.user.findUnique({
      where: { id: primaryTutorId },
      select: { id: true, role: true },
    });
    if (!tutor) throw new BadRequestException('用户不存在');
    if (tutor.role !== UserRole.TUTOR)
      throw new BadRequestException('用户不是导师');

    await this.prisma.order.update({
      where: { id: orderId },
      data: { primaryTutorId },
      select: { id: true },
    });

    return this.detail(orderId);
  }

  async unassignTutor(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('订单不存在');

    await this.prisma.order.update({
      where: { id: orderId },
      data: { primaryTutorId: null },
      select: { id: true },
    });

    return this.detail(orderId);
  }

  async linkTask(orderId: string, taskId: string, operatorId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, taskId: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.taskId) throw new BadRequestException('订单已绑定任务');

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, userId: true },
    });
    if (!task) throw new NotFoundException('任务不存在');

    if (order.userId !== task.userId) {
      throw new ForbiddenException('不允许跨用户绑定任务');
    }

    const bound = await this.prisma.order.findFirst({
      where: { taskId },
      select: { id: true },
    });
    if (bound) throw new BadRequestException('该任务已被其他订单绑定');

    try {
      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: orderId },
          data: { taskId },
          select: { id: true },
        }),
        this.prisma.taskAdminLog.create({
          data: {
            taskId,
            action: TaskAdminAction.LINK_ORDER,
            operatorId,
            orderId,
          },
          select: { id: true },
        }),
      ]);
    } catch (e: unknown) {
      const code =
        e && typeof e === 'object'
          ? (e as Record<string, unknown>)['code']
          : null;
      if (code === 'P2002') {
        throw new BadRequestException('该任务已被其他订单绑定');
      }
      throw e;
    }

    return this.detail(orderId);
  }

  async unlinkTask(orderId: string, operatorId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, taskId: true },
    });
    if (!order) throw new NotFoundException('订单不存在');

    const taskId = order.taskId;
    if (taskId) {
      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: orderId },
          data: { taskId: null },
          select: { id: true },
        }),
        this.prisma.taskAdminLog.create({
          data: {
            taskId,
            action: TaskAdminAction.UNLINK_ORDER,
            operatorId,
            orderId,
          },
          select: { id: true },
        }),
      ]);
    } else {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { taskId: null },
        select: { id: true },
      });
    }

    return this.detail(orderId);
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.detail(id);
    const next = dto.status;

    const allowed: Record<UpdateOrderStatusDto['status'], OrderStatus[]> = {
      FULFILLING: [OrderStatus.PAID],
      COMPLETED: [OrderStatus.FULFILLING],
      CANCELLED: [OrderStatus.PENDING, OrderStatus.PENDING_PAYMENT],
    };

    if (!allowed[next].includes(order.status)) {
      throw new BadRequestException(
        `当前状态 ${order.status} 不能切换到 ${next}`,
      );
    }

    const data: Prisma.OrderUpdateInput = {
      status: next,
    };
    if (next === 'COMPLETED') data.completedAt = new Date();
    if (next === 'CANCELLED') data.cancelledAt = new Date();

    return this.prisma.order.update({
      where: { id },
      data,
      select: { id: true, status: true },
    });
  }

  async createRefund(
    orderId: string,
    dto: CreateRefundDto,
    operatorId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { refunds: true },
    });
    if (!order) throw new NotFoundException('订单不存在');

    const refundableStatuses: OrderStatus[] = [
      OrderStatus.PAID,
      OrderStatus.FULFILLING,
    ];
    if (!refundableStatuses.includes(order.status)) {
      throw new BadRequestException('当前订单状态不允许发起退款');
    }

    const payAmount = order.paidAmountCents ?? order.amountCents;
    if (dto.amount > payAmount) {
      throw new BadRequestException('退款金额不能超过实付金额');
    }

    const pending = order.refunds.find(
      (r) => r.status === RefundStatus.PENDING,
    );
    if (pending) throw new BadRequestException('已存在未处理的退款单');

    const refundNo = generateRefundNo();

    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          refundNo,
          orderId,
          amountCents: dto.amount,
          reason: dto.reason,
          operatorId,
          status: RefundStatus.PENDING,
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.REFUNDING },
      });

      return refund;
    });
  }

  async resolveRefund(refundId: string, dto: ResolveRefundDto) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { order: true },
    });
    if (!refund) throw new NotFoundException('退款单不存在');
    if (refund.status !== RefundStatus.PENDING)
      throw new BadRequestException('退款单已处理');

    if (dto.action === 'REJECTED' && !dto.rejectReason?.trim()) {
      throw new BadRequestException('拒绝时必须填写原因');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedRefund = await tx.refund.update({
        where: { id: refundId },
        data: {
          status:
            dto.action === 'APPROVED'
              ? RefundStatus.APPROVED
              : RefundStatus.REJECTED,
          rejectReason: dto.action === 'REJECTED' ? dto.rejectReason : null,
          resolvedAt: new Date(),
        },
      });

      if (dto.action === 'APPROVED') {
        await tx.order.update({
          where: { id: refund.orderId },
          data: { status: OrderStatus.REFUNDED, refundedAt: new Date() },
        });
      } else {
        await tx.order.update({
          where: { id: refund.orderId },
          data: { status: OrderStatus.PAID },
        });
      }

      return updatedRefund;
    });
  }

  async stats(range?: { startDate?: string; endDate?: string }) {
    const where: Prisma.OrderWhereInput = {};
    if (range?.startDate || range?.endDate) {
      where.createdAt = {};
      if (range.startDate)
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(
          range.startDate,
        );
      if (range.endDate)
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(
          range.endDate,
        );
    }

    const [total, paid, refunded, sumPay] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.count({
        where: { ...where, status: OrderStatus.PAID },
      }),
      this.prisma.order.count({
        where: { ...where, status: OrderStatus.REFUNDED },
      }),
      this.prisma.order.aggregate({
        where: {
          ...where,
          status: {
            in: [
              OrderStatus.PAID,
              OrderStatus.FULFILLING,
              OrderStatus.COMPLETED,
            ],
          },
        },
        _sum: { paidAmountCents: true },
      }),
    ]);

    return { total, paid, refunded, revenue: sumPay._sum.paidAmountCents ?? 0 };
  }
}
