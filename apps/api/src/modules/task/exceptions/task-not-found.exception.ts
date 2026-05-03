import { HttpException, HttpStatus } from '@nestjs/common';

export class TaskNotFoundException extends HttpException {
  constructor(id: string) {
    super(`任务不存在: ${id}`, HttpStatus.NOT_FOUND);
  }
}
