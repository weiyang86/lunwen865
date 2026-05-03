import { HttpException, HttpStatus } from '@nestjs/common';

export class TopicGenerationFailedException extends HttpException {
  constructor(taskId: string, message: string) {
    super(`题目生成失败: ${taskId}，原因: ${message}`, HttpStatus.BAD_GATEWAY);
  }
}
