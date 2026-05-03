import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import path from 'node:path';
import { PrismaModule } from '../../prisma/prisma.module';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';
import { DeepSeekProvider } from './providers/deepseek.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { ProviderFactory } from './providers/provider.factory';
import { QwenProvider } from './providers/qwen.provider';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(__dirname, '../../../../.env'),
        path.resolve(__dirname, '../../../../.env.example'),
      ],
    }),
    PrismaModule,
  ],
  controllers: [LlmController],
  providers: [
    LlmService,
    ProviderFactory,
    OpenAiProvider,
    DeepSeekProvider,
    QwenProvider,
  ],
  exports: [LlmService],
})
export class LlmModule {}
