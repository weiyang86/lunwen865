import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QuotaType } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExchangeQuotaDto } from './dto/exchange-quota.dto';
import { QueryQuotaLogDto } from './dto/query-quota-log.dto';
import { QuotaService } from './quota.service';

@Controller('quota')
@UseGuards(JwtAuthGuard)
export class QuotaController {
  constructor(private readonly quotaService: QuotaService) {}

  @Get('me')
  getMine(@CurrentUser('id') uid: string) {
    return this.quotaService.getAllBalances(uid);
  }

  @Get('logs')
  myLogs(@CurrentUser('id') uid: string, @Query() q: QueryQuotaLogDto) {
    return this.quotaService.findLogs(uid, q);
  }

  @Get('exchange-rates')
  exchangeRates() {
    return this.quotaService.getExchangeRates();
  }

  @Post('exchange')
  async exchange(
    @CurrentUser('id') uid: string,
    @Body() dto: ExchangeQuotaDto,
  ) {
    if (
      dto.targetType !== QuotaType.PAPER_GENERATION &&
      dto.targetType !== QuotaType.POLISH &&
      dto.targetType !== QuotaType.EXPORT &&
      dto.targetType !== QuotaType.AI_CHAT
    ) {
      throw new BadRequestException('不支持的兑换类型');
    }
    await this.quotaService.exchangeFromBrainCell({
      userId: uid,
      targetType: dto.targetType,
      amount: dto.amount,
    });
    return this.quotaService.getAllBalances(uid);
  }
}
