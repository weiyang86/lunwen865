import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TaskModule } from '../task/task.module';
import { PromptModule } from '../prompt/prompt.module';
import { OutlineController } from './outline.controller';
import { OutlineGeneratorService } from './outline-generator.service';
import { OutlineNodeService } from './outline-node.service';
import { OutlineService } from './outline.service';
import { OutlineValidatorService } from './outline-validator.service';

@Module({
  imports: [PrismaModule, TaskModule, PromptModule],
  controllers: [OutlineController],
  providers: [
    OutlineService,
    OutlineNodeService,
    OutlineGeneratorService,
    OutlineValidatorService,
  ],
  exports: [OutlineService],
})
export class OutlineModule {}
