import { ConflictException } from '@nestjs/common';

export class OutlineLockedException extends ConflictException {
  constructor(taskId: string) {
    super(`大纲已锁定，禁止编辑（taskId=${taskId}）`);
  }
}
