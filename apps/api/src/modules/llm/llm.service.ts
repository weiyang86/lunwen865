import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LLM_ERROR_CODES } from './constants/error-codes.constant';
import { ProviderFactory } from './providers/provider.factory';
import type {
  GenerationStageName,
  LlmOptions,
  LlmProviderName,
} from './interfaces/llm-options.interface';
import type { LlmResponse } from './interfaces/llm-response.interface';
import { estimateTokens } from './utils/token-counter.util';
import { calculateCostUsd } from './utils/cost-calculator.util';
import { withRetry } from './utils/retry.util';
import { LlmException } from './exceptions/llm.exception';
import { z, ZodSchema } from 'zod';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

function getHttpStatus(error: unknown): number | null {
  if (!isRecord(error)) return null;
  const status = error['status'];
  if (typeof status === 'number') return status;
  const response = error['response'];
  if (isRecord(response) && typeof response['status'] === 'number')
    return response['status'];
  return null;
}

function isAbortError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return error['name'] === 'AbortError';
}

function mapProviderToPrisma(provider: LlmProviderName): LlmProvider {
  if (provider === 'openai') return 'OPENAI';
  if (provider === 'deepseek') return 'DEEPSEEK';
  return 'QWEN';
}

type LlmProvider = 'OPENAI' | 'DEEPSEEK' | 'QWEN';

type SimpleJsonSchema =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | { [key: string]: SimpleJsonSchema }
  | SimpleJsonSchema[];

function validateSimpleSchema(
  value: unknown,
  schema: SimpleJsonSchema,
): boolean {
  if (schema === 'string') return typeof value === 'string';
  if (schema === 'number')
    return typeof value === 'number' && Number.isFinite(value);
  if (schema === 'boolean') return typeof value === 'boolean';
  if (schema === 'array') return Array.isArray(value);
  if (schema === 'object') return isRecord(value);

  if (Array.isArray(schema)) {
    if (!Array.isArray(value)) return false;
    if (schema.length === 0) return true;
    return value.every((item) => validateSimpleSchema(item, schema[0]));
  }

  if (!isRecord(value)) return false;
  for (const [key, childSchema] of Object.entries(schema)) {
    if (!(key in value)) return false;
    if (!validateSimpleSchema(value[key], childSchema)) return false;
  }
  return true;
}

function stripJsonCodeFence(text: string): string {
  const trimmed = text.trim();
  const withoutStart = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '');
  return withoutStart.replace(/```$/i, '').trim();
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly providerFactory: ProviderFactory,
  ) {}

  /**
   * 普通文本生成
   */
  async generate(prompt: string, options?: LlmOptions): Promise<LlmResponse> {
    try {
      const resolved = this.resolveOptions(options);
      const provider = this.providerFactory.getProvider(resolved.provider);
      const model = resolved.model ?? provider.defaultModel;
      const startedAt = Date.now();

      const estimatedPromptTokens = estimateTokens(
        resolved.systemPrompt
          ? `${resolved.systemPrompt}\n\n${prompt}`
          : prompt,
      );

      const raw = await withRetry(
        () => provider.generate(prompt, { ...resolved, model }),
        {
          maxRetries: resolved.maxRetries,
          backoffMs: [1000, 2000, 4000],
          shouldRetry: (error) => this.shouldRetry(error),
          onRetry: (attempt, error) => {
            const status = getHttpStatus(error);
            this.logger.warn(
              `LLM 调用重试 attempt=${attempt} provider=${provider.name} model=${model} status=${status ?? 'n/a'} message=${getErrorMessage(error)}`,
            );
          },
        },
      );

      const duration = Date.now() - startedAt;

      const promptTokens = raw.promptTokens ?? estimatedPromptTokens;
      const completionTokens =
        raw.completionTokens ?? estimateTokens(raw.content);
      const totalTokens = raw.totalTokens ?? promptTokens + completionTokens;

      const { cost, pricingModel, usedFallbackPricing } = calculateCostUsd({
        promptTokens,
        completionTokens,
        model,
      });

      if (usedFallbackPricing) {
        this.logger.warn(
          `未知 model 单价，已按 ${pricingModel} 单价计算：model=${model}`,
        );
      }

      const logId = await this.writeGenerationLogSafely({
        taskId: resolved.taskId,
        stage: resolved.stage,
        targetId: resolved.targetId,
        provider: mapProviderToPrisma(provider.name as LlmProviderName),
        model,
        prompt,
        response: raw.content,
        promptTokens,
        completionTokens,
        totalTokens,
        cost,
        duration,
        success: true,
      });

      return {
        content: raw.content,
        provider: provider.name,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        cost,
        duration,
        logId,
      };
    } catch (error: unknown) {
      const resolved = this.resolveOptions(options, true);
      const providerName =
        resolved.provider ?? this.providerFactory.getDefaultProviderName();
      const provider = this.providerFactory.getProvider(providerName);
      const model = resolved.model ?? provider.defaultModel;
      const startedAt = Date.now();
      const duration = Date.now() - startedAt;

      const estimatedPromptTokens = estimateTokens(
        resolved.systemPrompt
          ? `${resolved.systemPrompt}\n\n${prompt}`
          : prompt,
      );

      const code = this.mapErrorToCode(error);
      await this.writeGenerationLogSafely({
        taskId: resolved.taskId,
        stage: resolved.stage,
        targetId: resolved.targetId,
        provider: mapProviderToPrisma(provider.name as LlmProviderName),
        model,
        prompt,
        response: '',
        promptTokens: estimatedPromptTokens,
        completionTokens: 0,
        totalTokens: estimatedPromptTokens,
        cost: 0,
        duration,
        success: false,
        errorMessage: getErrorMessage(error),
      });

      throw new LlmException({
        code,
        message: getErrorMessage(error),
        provider: provider.name,
        model,
        cause: error,
      });
    }
  }

  /**
   * 结构化 JSON 生成（自动校验 + 解析）
   */
  async generateJson<T>(
    prompt: string,
    schema: ZodSchema<T> | object,
    options?: LlmOptions,
  ): Promise<T> {
    try {
      const instruction =
        '\n\n请严格按以下 JSON 格式输出，不要包含 markdown 代码块标记。';
      const finalPrompt = `${prompt}${instruction}`;

      const tryParse = async (): Promise<T> => {
        const resp = await this.generate(finalPrompt, options);
        const text = stripJsonCodeFence(resp.content);

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new LlmException({
            code: LLM_ERROR_CODES.LLM_JSON_PARSE_FAILED,
            message: 'JSON.parse 失败',
          });
        }

        if (schema instanceof z.ZodType) {
          const result = schema.safeParse(parsed);
          if (!result.success) {
            throw new LlmException({
              code: LLM_ERROR_CODES.LLM_INVALID_RESPONSE,
              message: 'JSON 校验失败',
            });
          }
          return result.data;
        }

        const simpleSchema = schema as SimpleJsonSchema;
        if (!validateSimpleSchema(parsed, simpleSchema)) {
          throw new LlmException({
            code: LLM_ERROR_CODES.LLM_INVALID_RESPONSE,
            message: 'JSON 校验失败',
          });
        }

        return parsed as T;
      };

      try {
        return await tryParse();
      } catch (error: unknown) {
        const code =
          error instanceof LlmException
            ? error.code
            : this.mapErrorToCode(error);
        if (code !== LLM_ERROR_CODES.LLM_JSON_PARSE_FAILED) throw error;
        return await tryParse();
      }
    } catch (error: unknown) {
      if (error instanceof LlmException) throw error;
      throw new LlmException({
        code: this.mapErrorToCode(error),
        message: getErrorMessage(error),
        cause: error,
      });
    }
  }

  /**
   * 流式生成
   */
  async *generateStream(
    prompt: string,
    options?: LlmOptions,
  ): AsyncIterable<string> {
    const resolved = this.resolveOptions(options);
    const provider = this.providerFactory.getProvider(resolved.provider);
    const model = resolved.model ?? provider.defaultModel;
    const startedAt = Date.now();

    const estimatedPromptTokens = estimateTokens(
      resolved.systemPrompt ? `${resolved.systemPrompt}\n\n${prompt}` : prompt,
    );

    let fullContent = '';
    let success = false;
    let errorMessage: string | undefined;

    try {
      const stream = await withRetry(
        () =>
          Promise.resolve(
            provider.generateStream(prompt, { ...resolved, model }),
          ),
        {
          maxRetries: resolved.maxRetries,
          backoffMs: [1000, 2000, 4000],
          shouldRetry: (error) => this.shouldRetry(error),
          onRetry: (attempt, error) => {
            const status = getHttpStatus(error);
            this.logger.warn(
              `LLM 流式调用重试 attempt=${attempt} provider=${provider.name} model=${model} status=${status ?? 'n/a'} message=${getErrorMessage(error)}`,
            );
          },
        },
      );

      for await (const chunk of stream) {
        fullContent += chunk;
        yield chunk;
      }

      success = true;
    } catch (error: unknown) {
      errorMessage = getErrorMessage(error);
      throw new LlmException({
        code: this.mapErrorToCode(error),
        message: errorMessage,
        provider: provider.name,
        model,
        cause: error,
      });
    } finally {
      const duration = Date.now() - startedAt;
      const completionTokens = estimateTokens(fullContent);
      const totalTokens = estimatedPromptTokens + completionTokens;
      const { cost, pricingModel, usedFallbackPricing } = calculateCostUsd({
        promptTokens: estimatedPromptTokens,
        completionTokens,
        model,
      });

      if (usedFallbackPricing) {
        this.logger.warn(
          `未知 model 单价，已按 ${pricingModel} 单价计算：model=${model}`,
        );
      }

      await this.writeGenerationLogSafely({
        taskId: resolved.taskId,
        stage: resolved.stage,
        targetId: resolved.targetId,
        provider: mapProviderToPrisma(provider.name as LlmProviderName),
        model,
        prompt,
        response: fullContent,
        promptTokens: estimatedPromptTokens,
        completionTokens,
        totalTokens,
        cost,
        duration,
        success,
        errorMessage,
      });
    }
  }

  /**
   * 估算 token（不调用 API）
   */
  estimateTokens(text: string): number {
    return estimateTokens(text);
  }

  /**
   * 估算成本（不调用 API）
   */
  estimateCost(
    promptTokens: number,
    completionTokens: number,
    model: string,
  ): number {
    const { cost } = calculateCostUsd({
      promptTokens,
      completionTokens,
      model,
    });
    return cost;
  }

  private resolveOptions(
    options?: LlmOptions,
    allowPartial: boolean = false,
  ): {
    provider: LlmProviderName;
    model?: string;
    temperature: number;
    maxTokens: number;
    topP?: number;
    systemPrompt?: string;
    taskId: string;
    stage: GenerationStageName;
    targetId?: string;
    maxRetries: number;
    timeout: number;
  } {
    const defaultProvider = this.providerFactory.getDefaultProviderName();
    const provider = options?.provider ?? defaultProvider;

    const temperature =
      options?.temperature ?? this.getNumber('LLM_DEFAULT_TEMPERATURE', 0.7);
    const maxTokens =
      options?.maxTokens ?? this.getInt('LLM_DEFAULT_MAX_TOKENS', 4096);
    const topP = options?.topP;
    const systemPrompt = options?.systemPrompt;
    const timeout =
      options?.timeout ?? this.getInt('LLM_DEFAULT_TIMEOUT', 60_000);
    const maxRetries =
      options?.maxRetries ?? this.getInt('LLM_DEFAULT_MAX_RETRIES', 3);

    const taskId = options?.taskId ?? (allowPartial ? '' : '');
    const stage = options?.stage;

    if (!allowPartial) {
      if (!taskId) {
        throw new LlmException({
          code: LLM_ERROR_CODES.LLM_PROVIDER_ERROR,
          message: 'taskId 必填，用于写入 GenerationLog',
        });
      }
      if (!stage) {
        throw new LlmException({
          code: LLM_ERROR_CODES.LLM_PROVIDER_ERROR,
          message: 'stage 必填，用于写入 GenerationLog',
        });
      }
    }

    return {
      provider,
      model: options?.model,
      temperature,
      maxTokens,
      topP,
      systemPrompt,
      taskId,
      stage: stage ?? 'TOPIC',
      targetId: options?.targetId,
      maxRetries,
      timeout,
    };
  }

  private shouldRetry(error: unknown): boolean {
    if (isAbortError(error)) return true;

    const status = getHttpStatus(error);
    if (status === 429) return true;
    if (status !== null && status >= 500) return true;
    if (status !== null && status >= 400) return false;

    const message = getErrorMessage(error).toLowerCase();
    if (message.includes('network')) return true;
    if (message.includes('fetch')) return true;
    if (message.includes('timeout')) return true;

    return false;
  }

  private mapErrorToCode(error: unknown) {
    if (isAbortError(error)) return LLM_ERROR_CODES.LLM_TIMEOUT;

    const status = getHttpStatus(error);
    if (status === 429) return LLM_ERROR_CODES.LLM_RATE_LIMIT;
    if (status === 401 || status === 403)
      return LLM_ERROR_CODES.LLM_QUOTA_EXCEEDED;
    if (status !== null && status >= 400)
      return LLM_ERROR_CODES.LLM_PROVIDER_ERROR;

    const message = getErrorMessage(error).toLowerCase();
    if (message.includes('quota')) return LLM_ERROR_CODES.LLM_QUOTA_EXCEEDED;

    return LLM_ERROR_CODES.LLM_PROVIDER_ERROR;
  }

  private getNumber(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (!raw) return fallback;
    const num = Number(raw);
    return Number.isFinite(num) ? num : fallback;
  }

  private getInt(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (!raw) return fallback;
    const num = Number.parseInt(raw, 10);
    return Number.isFinite(num) ? num : fallback;
  }

  private async writeGenerationLogSafely(data: {
    taskId: string;
    stage: GenerationStageName;
    targetId?: string;
    provider: LlmProvider;
    model: string;
    prompt: string;
    response: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    duration: number;
    success: boolean;
    errorMessage?: string;
  }): Promise<string> {
    try {
      const log = await this.prisma.generationLog.create({
        data: {
          taskId: data.taskId,
          stage: data.stage,
          targetId: data.targetId,
          provider: data.provider,
          model: data.model,
          prompt: data.prompt,
          response: data.response,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalTokens: data.totalTokens,
          cost: new Prisma.Decimal(data.cost),
          durationMs: data.duration,
          success: data.success,
          errorMessage: data.errorMessage,
        },
        select: { id: true },
      });
      return log.id;
    } catch (logError: unknown) {
      if (
        logError instanceof Prisma.PrismaClientKnownRequestError &&
        logError.code === 'P2003'
      ) {
        try {
          const fallbackLog = await this.prisma.generationLog.create({
            data: {
              taskId: null,
              stage: data.stage,
              targetId: data.targetId,
              provider: data.provider,
              model: data.model,
              prompt: data.prompt,
              response: data.response,
              promptTokens: data.promptTokens,
              completionTokens: data.completionTokens,
              totalTokens: data.totalTokens,
              cost: new Prisma.Decimal(data.cost),
              durationMs: data.duration,
              success: data.success,
              errorMessage: data.errorMessage,
            },
            select: { id: true },
          });
          this.logger.warn(
            `GenerationLog 写入时 taskId 外键不存在，已降级写入 taskId=null：taskId=${data.taskId}`,
          );
          return fallbackLog.id;
        } catch (fallbackError: unknown) {
          this.logger.error(
            'Failed to write GenerationLog (fallback taskId=null)',
            fallbackError,
          );
          return '';
        }
      }

      this.logger.error('Failed to write GenerationLog', logError);
      return '';
    }
  }
}
