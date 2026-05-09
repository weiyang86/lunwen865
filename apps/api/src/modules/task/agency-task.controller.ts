import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaskService } from './task.service';

@Controller('agency/tasks')
@UseGuards(JwtAuthGuard)
export class AgencyTaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get(':id/timeline')
  async timeline(
    @CurrentUser() currentUser: Record<string, unknown>,
    @Param('id') id: string,
  ) {
    return this.taskService.getTimelineForAgency(id, currentUser);
  }
}
