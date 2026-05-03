import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { OrderService } from './order.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(
    @CurrentUser('id') uid: string,
    @Body() dto: CreateOrderDto,
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? undefined;
    return this.orderService.create(uid, dto, ip);
  }

  @Get()
  findAll(@CurrentUser('id') uid: string, @Query() q: QueryOrderDto) {
    return this.orderService.findAll(uid, q);
  }

  @Get(':id')
  findOne(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.orderService.findOne(uid, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.orderService.cancel(uid, id);
  }
}
