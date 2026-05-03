import { HttpException, HttpStatus } from '@nestjs/common';
import { GenerationStage } from '../constants/generation-stage.enum';

export class InvalidStageException extends HttpException {
  constructor(currentStage: GenerationStage, targetStage: GenerationStage) {
    super(
      `非法阶段推进: 不能从 ${currentStage} 推进到 ${targetStage}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}
