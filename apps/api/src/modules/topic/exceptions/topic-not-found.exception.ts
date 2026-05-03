import { HttpException, HttpStatus } from '@nestjs/common';

export class TopicNotFoundException extends HttpException {
  constructor(candidateId: string) {
    super(`题目候选不存在: ${candidateId}`, HttpStatus.NOT_FOUND);
  }
}
