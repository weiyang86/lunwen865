import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PolishService } from './polish.service';
import { CreatePolishDto } from './dto/create-polish.dto';
import { QueryPolishDto } from './dto/query-polish.dto';
import { PolishStatus } from '@prisma/client';
import { Observable } from 'rxjs';

@Controller('polish')
@UseGuards(JwtAuthGuard)
export class PolishController {
  constructor(private readonly polishService: PolishService) {}

  @Post()
  @ApiOperation({ summary: '创建降 AI 任务' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreatePolishDto) {
    return this.polishService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: '我的任务列表' })
  list(@CurrentUser('id') userId: string, @Query() query: QueryPolishDto) {
    return this.polishService.findAll(userId, query);
  }

  @Get('stats/me')
  @ApiOperation({ summary: '我的统计' })
  stats(@CurrentUser('id') userId: string) {
    return this.polishService.getStats(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '任务详情' })
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.polishService.findOne(userId, id);
  }

  @Get(':id/diff')
  @ApiOperation({ summary: '段落对比' })
  diff(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.polishService.getDiff(userId, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: '取消任务' })
  cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.polishService.cancel(userId, id);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: '重试任务' })
  retry(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.polishService.retry(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除任务' })
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.polishService.delete(userId, id);
    return { success: true };
  }

  @Sse(':id/stream')
  @ApiOperation({ summary: 'SSE 实时进度' })
  stream(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((observer) => {
      let done = false;
      const tick = async () => {
        if (done) return;
        try {
          const task = await this.polishService.findOne(userId, id);
          observer.next({
            data: {
              status: task.status,
              progress: task.progress,
              errorMessage: task.errorMessage,
            },
          });

          if (
            task.status === PolishStatus.SUCCESS ||
            task.status === PolishStatus.FAILED ||
            task.status === PolishStatus.CANCELLED
          ) {
            done = true;
            observer.complete();
          }
        } catch (e) {
          done = true;
          observer.error(e);
        }
      };

      void tick();
      const intervalId = setInterval(() => void tick(), 1000);
      const timeoutId = setTimeout(() => {
        done = true;
        clearInterval(intervalId);
        observer.complete();
      }, 600000);

      return () => {
        done = true;
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      };
    });
  }
}
