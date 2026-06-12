import { Injectable } from '@nestjs/common';
import type { ThesisSkillVersion } from '@prisma/client';

const TEMPLATE_VARIABLES = [
  'taskTitle',
  'schoolName',
  'collegeName',
  'majorName',
  'educationLevel',
  'thesisType',
  'stage',
  'researchDirection',
  'advisorRequirement',
  'userRequirement',
] as const;

type SkillInputPayload = Record<string, unknown>;

@Injectable()
export class ThesisSkillRunnerService {
  resolvePrompt(
    version: Pick<ThesisSkillVersion, 'promptTemplate'>,
    input: SkillInputPayload,
  ) {
    return TEMPLATE_VARIABLES.reduce((prompt, key) => {
      const value = input[key];
      const replacement =
        value === undefined || value === null
          ? ''
          : typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean'
            ? String(value)
            : JSON.stringify(value);
      return prompt.replaceAll(`{{${key}}}`, replacement);
    }, version.promptTemplate);
  }

  preview(
    version: Pick<ThesisSkillVersion, 'promptTemplate' | 'modelConfig'>,
    input: SkillInputPayload,
  ) {
    const resolvedPrompt = this.resolvePrompt(version, input);
    return {
      outputPayload: {
        mode: 'mock-preview',
        resolvedPrompt,
        preview: {
          summary:
            'Skill 测试运行已生成 Prompt 预览。后续接入真实模型后，此处返回模型输出。',
          sections: [
            { title: '输入上下文', content: input },
            {
              title: '合规提示',
              content:
                '本能力仅用于论文辅导与写作辅助，不伪造数据、不伪造引用、不承诺规避查重。',
            },
          ],
        },
      },
      qualityResult: {
        mode: 'mock-preview',
        passed: true,
        checks: [
          { key: 'hasPrompt', passed: resolvedPrompt.trim().length > 0 },
          {
            key: 'hasComplianceBoundary',
            passed: /不伪造|合规|辅导/.test(resolvedPrompt),
          },
        ],
      },
      tokenUsage: {
        promptChars: resolvedPrompt.length,
        estimatedPromptTokens: Math.ceil(resolvedPrompt.length / 4),
      },
      modelName: this.getModelName(version.modelConfig),
    };
  }

  private getModelName(modelConfig: unknown) {
    if (!modelConfig || typeof modelConfig !== 'object')
      return 'skill-preview-v1';
    const model = (modelConfig as Record<string, unknown>).model;
    return typeof model === 'string' && model ? model : 'skill-preview-v1';
  }
}
