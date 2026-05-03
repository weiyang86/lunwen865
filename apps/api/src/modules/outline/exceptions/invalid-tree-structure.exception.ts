import { BadRequestException } from '@nestjs/common';

export class InvalidTreeStructureException extends BadRequestException {
  constructor(message: string) {
    super(`大纲结构不合法：${message}`);
  }
}
