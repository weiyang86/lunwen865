import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
}
