import { HttpException, HttpStatus } from '@nestjs/common';

export class SectionGenerationFailedException extends HttpException {
  constructor(sectionKey: string, message: string, recoverable: boolean) {
    super(
      {
        message: `章节生成失败: ${sectionKey}，原因: ${message}`,
        recoverable,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
