import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminThesisSkillController } from './admin-thesis-skill.controller';
import { ThesisSkillRunnerService } from './thesis-skill-runner.service';
import { ThesisSkillService } from './thesis-skill.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminThesisSkillController],
  providers: [ThesisSkillService, ThesisSkillRunnerService],
  exports: [ThesisSkillService, ThesisSkillRunnerService],
})
export class ThesisSkillModule {}
