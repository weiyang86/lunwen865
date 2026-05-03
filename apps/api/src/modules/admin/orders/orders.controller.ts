import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AssignTutorDto } from './dto/assign-tutor.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { LinkTaskDto } from './dto/link-task.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { ResolveRefundDto } from './dto/resolve-refund.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  list(@Query() dto: ListOrdersDto) {
    return this.service.list(dto);
  }

  @Get('stats')
  stats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.stats({ startDate, endDate });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Patch(':id/link-task')
  linkTask(
    @Param('id') id: string,
    @Body() dto: LinkTaskDto,
    @CurrentUser('id') operatorId: string,
  ) {
    return this.service.linkTask(id, dto.taskId, operatorId);
  }

  @Delete(':id/link-task')
  unlinkTask(@Param('id') id: string, @CurrentUser('id') operatorId: string) {
    return this.service.unlinkTask(id, operatorId);
  }

  @Patch(':id/assign-tutor')
  assignTutor(@Param('id') id: string, @Body() dto: AssignTutorDto) {
    return this.service.assignTutor(id, dto.primaryTutorId);
  }

  @Patch(':id/unassign-tutor')
  unassignTutor(@Param('id') id: string) {
    return this.service.unassignTutor(id);
  }

  @Post(':id/refunds')
  createRefund(
    @Param('id') id: string,
    @Body() dto: CreateRefundDto,
    @CurrentUser('id') operatorId: string,
  ) {
    return this.service.createRefund(id, dto, operatorId);
  }

  @Patch('refunds/:refundId')
  resolveRefund(
    @Param('refundId') refundId: string,
    @Body() dto: ResolveRefundDto,
  ) {
    return this.service.resolveRefund(refundId, dto);
  }
}
