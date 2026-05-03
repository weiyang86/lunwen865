import { Controller, Get, Post } from '@nestjs/common';
import { TaskService } from './task.service';

@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post('test')
  createTest() {
    return this.taskService.createTest();
  }

  @Get()
  findAll() {
    return this.taskService.findAll();
  }
}
