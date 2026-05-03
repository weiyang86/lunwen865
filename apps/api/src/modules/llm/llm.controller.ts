import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { LlmService } from './llm.service';
import { GenerateDtoSchema, GenerateJsonDtoSchema } from './dto/generate.dto';
import { Public } from '../auth/decorators/public.decorator';

const GenerationStageSchema = z.enum([
  'TOPIC',
  'OPENING',
  'OUTLINE',
  'CHAPTER',
  'SECTION',
  'SUMMARY',
]);

@Public()
@Controller('llm/test')
export class LlmController {
  constructor(
    private readonly llmService: LlmService,
    private readonly configService: ConfigService,
  ) {}

  @Post('generate')
  async generate(@Body() body: unknown) {
    this.ensureEnabled();

    const dto = GenerateDtoSchema.parse(body);
    const stage = GenerationStageSchema.parse(dto.stage);

    return this.llmService.generate(dto.prompt, {
      taskId: dto.taskId,
      stage,
      provider: dto.provider,
      model: dto.model,
    });
  }

  @Post('generate-json')
  async generateJson(@Body() body: unknown) {
    this.ensureEnabled();

    const dto = GenerateJsonDtoSchema.parse(body);
    const stage = GenerationStageSchema.parse(dto.stage);

    const schema = z.object({
      result: z.string(),
    });

    return this.llmService.generateJson(dto.prompt, schema, {
      taskId: dto.taskId,
      stage,
      provider: dto.provider,
      model: dto.model,
    });
  }

  @Get('estimate-cost')
  estimateCost(@Query('text') text: string, @Query('model') model: string) {
    this.ensureEnabled();

    const promptTokens = this.llmService.estimateTokens(text ?? '');
    const cost = this.llmService.estimateCost(
      promptTokens,
      0,
      model ?? 'gpt-4o-mini',
    );

    return {
      promptTokens,
      completionTokens: 0,
      totalTokens: promptTokens,
      cost,
      model: model ?? 'gpt-4o-mini',
    };
  }

  private ensureEnabled(): void {
    const raw = (
      this.configService.get<string>('LLM_TEST_ENDPOINT_ENABLED') ?? 'false'
    )
      .trim()
      .toLowerCase();

    const enabled = raw === 'true' || raw === '1';
    if (!enabled) {
      throw new NotFoundException();
    }
  }
}
