import { BadRequestException } from '@nestjs/common';

export class OutlineNotLockedException extends BadRequestException {
  constructor(taskId: string) {
    super(`大纲未锁定，禁止启动写作（taskId=${taskId}）`);
  }
}
