import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AgencyOrderService } from './agency-order.service';
import { CreateAgencyOrderDto } from './dto/create-agency-order.dto';
import { QueryAgencyOrderDto } from './dto/query-agency-order.dto';

@Controller('agency/orders')
@UseGuards(JwtAuthGuard)
export class AgencyOrderController {
  constructor(private readonly agencyOrderService: AgencyOrderService) {}

  @Post()
  create(
    @CurrentUser('id') operatorId: string,
    @Body() dto: CreateAgencyOrderDto,
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? undefined;
    return this.agencyOrderService.create(operatorId, dto, ip);
  }

  @Get()
  findAll(
    @CurrentUser('id') operatorId: string,
    @Query() query: QueryAgencyOrderDto,
  ) {
    return this.agencyOrderService.findAll(operatorId, query);
  }
}
