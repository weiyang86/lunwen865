import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LlmModule } from '../llm/llm.module';
import { TaskModule } from '../task/task.module';
import { PromptModule } from '../prompt/prompt.module';
import { WritingController } from './writing.controller';
import { ReferenceResolverService } from './services/reference-resolver.service';
import { WritingContextService } from './services/writing-context.service';
import { WritingGeneratorService } from './services/writing-generator.service';
import { WritingOrchestratorService } from './services/writing-orchestrator.service';
import { WritingRecoveryService } from './services/writing-recovery.service';
import { WritingSectionService } from './services/writing-section.service';
import { WritingService } from './services/writing.service';
import { WritingSessionService } from './services/writing-session.service';

@Module({
  imports: [PrismaModule, TaskModule, LlmModule, PromptModule],
  controllers: [WritingController],
  providers: [
    WritingService,
    WritingRecoveryService,
    WritingOrchestratorService,
    WritingSessionService,
    WritingSectionService,
    WritingContextService,
    WritingGeneratorService,
    ReferenceResolverService,
  ],
  exports: [WritingService],
})
export class WritingModule {}
