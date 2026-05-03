import { ConflictException } from '@nestjs/common';

export class WritingAlreadyRunningException extends ConflictException {
  constructor(taskId: string) {
    super(`已有进行中的写作任务（taskId=${taskId}）`);
  }
}
