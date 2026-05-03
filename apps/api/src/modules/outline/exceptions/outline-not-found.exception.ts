import { NotFoundException } from '@nestjs/common';

export class OutlineNotFoundException extends NotFoundException {
  constructor(taskId: string) {
    super(`大纲不存在（taskId=${taskId}）`);
  }
}
