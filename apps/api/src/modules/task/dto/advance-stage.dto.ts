import { IsEnum } from 'class-validator';
import { GenerationStage } from '../constants/generation-stage.enum';

export class AdvanceStageDto {
  @IsEnum(GenerationStage)
  targetStage!: GenerationStage;
}
