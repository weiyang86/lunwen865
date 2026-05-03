import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class WritingRecoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WritingRecoveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const now = new Date();
      const orphanMessage = '服务重启：写作生成中断';

      const result = await this.prisma.$transaction(async (tx) => {
        const sessions = await tx.writingSession.findMany({
          where: { status: 'GENERATING' },
          select: { id: true },
        });
        const sessionIds = sessions.map((s) => s.id);
        if (sessionIds.length === 0) return { sessions: 0, sections: 0 };

        const nowTime = new Date();

        const sectionsResult = await tx.writingSection.updateMany({
          where: { sessionId: { in: sessionIds }, status: 'GENERATING' },
          data: {
            status: 'FAILED',
            errorMessage: orphanMessage,
            finishedAt: nowTime,
          },
        });

        const sessionsResult = await tx.writingSession.updateMany({
          where: { id: { in: sessionIds } },
          data: {
            status: 'FAILED',
            errorMessage: orphanMessage,
            currentSectionId: null,
            finishedAt: nowTime,
          },
        });

        return {
          sessions: sessionsResult.count,
          sections: sectionsResult.count,
        };
      });

      if (result.sessions > 0 || result.sections > 0) {
        this.logger.warn(
          `已清理孤儿写作状态: sessions=${result.sessions} sections=${result.sections} at=${now.toISOString()}`,
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`写作恢复清理失败: ${message}`);
    }
  }
}
