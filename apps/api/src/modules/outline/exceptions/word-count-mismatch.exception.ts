import { BadRequestException } from '@nestjs/common';

export class WordCountMismatchException extends BadRequestException {
  constructor(message: string) {
    super(`大纲字数不符合要求：${message}`);
  }
}
