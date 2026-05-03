import { HttpException, HttpStatus } from '@nestjs/common';
import { TaskStatus } from '../constants/task-status.enum';

export class InvalidTaskTransitionException extends HttpException {
  constructor(from: TaskStatus, to: TaskStatus, allowed: TaskStatus[]) {
    super(
      `非法状态跃迁: 不能从 ${from} 跃迁到 ${to}，允许的目标状态: [${allowed.join(', ')}]`,
      HttpStatus.BAD_REQUEST,
    );
  }
}
