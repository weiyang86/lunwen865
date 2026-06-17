import { Module } from '@nestjs/common';
import { AdminThesisSkillController } from './admin-thesis-skill.controller';
import { ThesisSkillRunnerService } from './thesis-skill-runner.service';
import { ThesisSkillService } from './thesis-skill.service';

@Module({
  controllers: [AdminThesisSkillController],
  providers: [ThesisSkillService, ThesisSkillRunnerService],
  exports: [ThesisSkillService, ThesisSkillRunnerService],
})
export class ThesisSkillModule {}
