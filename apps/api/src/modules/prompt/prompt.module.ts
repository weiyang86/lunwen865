import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminPromptsController } from './admin-prompts.controller';
import { AdminPromptController } from './admin-prompt.controller';
import { AdminPromptService } from './admin-prompt.service';
import { PromptService } from './prompt.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminPromptController, AdminPromptsController],
  providers: [PromptService, AdminPromptService],
  exports: [PromptService],
})
export class PromptModule {}
