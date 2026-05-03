import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LlmModule } from '../llm/llm.module';
import { UserModule } from '../user/user.module';
import { QuotaModule } from '../quota/quota.module';
import { PromptModule } from '../prompt/prompt.module';
import { AdminPolishController } from './admin-polish.controller';
import { AdminPolishService } from './admin-polish.service';
import { AiDetectorService } from './detector/ai-detector.service';
import { PolishController } from './polish.controller';
import { PolishProcessor } from './polish.processor';
import { PolishQueue } from './polish.queue';
import { PolishService } from './polish.service';

@Module({
  imports: [
    PrismaModule,
    LlmModule,
    forwardRef(() => UserModule),
    QuotaModule,
    PromptModule,
  ],
  controllers: [PolishController, AdminPolishController],
  providers: [
    PolishService,
    AdminPolishService,
    PolishProcessor,
    PolishQueue,
    AiDetectorService,
  ],
  exports: [PolishService],
})
export class PolishModule {}
