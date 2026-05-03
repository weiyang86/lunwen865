import { NotFoundException } from '@nestjs/common';

export class WritingSessionNotFoundException extends NotFoundException {
  constructor(taskId: string) {
    super(`写作会话不存在（taskId=${taskId}）`);
  }
}
