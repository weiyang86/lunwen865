import { HttpException, HttpStatus } from '@nestjs/common';

export class ReportNotFoundException extends HttpException {
  constructor(taskId: string) {
    super(`开题报告不存在: ${taskId}`, HttpStatus.NOT_FOUND);
  }
}
