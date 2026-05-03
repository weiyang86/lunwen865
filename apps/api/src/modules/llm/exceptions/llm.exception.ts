import { HttpException, HttpStatus } from '@nestjs/common';
import type { LlmErrorCode } from '../constants/error-codes.constant';

export class LlmException extends HttpException {
  public readonly code: LlmErrorCode;

  constructor(options: {
    code: LlmErrorCode;
    message: string;
    status?: number;
    cause?: unknown;
    provider?: string;
    model?: string;
  }) {
    super(
      {
        code: options.code,
        message: options.message,
        provider: options.provider,
        model: options.model,
      },
      options.status ?? HttpStatus.BAD_GATEWAY,
      { cause: options.cause },
    );
    this.code = options.code;
  }
}
