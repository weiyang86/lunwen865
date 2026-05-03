import { z } from 'zod';

export interface LlmOutlineNode {
  title: string;
  summary: string;
  expectedWords?: number;
  children?: LlmOutlineNode[];
}

export interface LlmOutlineResponse {
  chapters: LlmOutlineNode[];
}

export const LLM_OUTLINE_NODE_SCHEMA: z.ZodType<LlmOutlineNode> = z.lazy(() => {
  return z.object({
    title: z.string().min(2).max(50),
    summary: z.string().min(20).max(300),
    expectedWords: z.number().int().min(200).max(3000).optional(),
    children: z.array(LLM_OUTLINE_NODE_SCHEMA).optional(),
  });
});

export const OUTLINE_JSON_SCHEMA: z.ZodSchema<LlmOutlineResponse> = z
  .object({
    chapters: z.array(LLM_OUTLINE_NODE_SCHEMA).min(4).max(8),
  })
  .superRefine((val, ctx) => {
    val.chapters.forEach((chapter, i) => {
      if (!Array.isArray(chapter.children) || chapter.children.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '章节点 children 不能为空',
          path: ['chapters', i, 'children'],
        });
        return;
      }

      if (chapter.children.length < 2 || chapter.children.length > 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '章节点 children 数量必须在 2~8 之间',
          path: ['chapters', i, 'children'],
        });
      }

      chapter.children.forEach((sec, j) => {
        if (typeof sec.expectedWords !== 'number') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '节节点必须包含 expectedWords',
            path: ['chapters', i, 'children', j, 'expectedWords'],
          });
        }
      });
    });
  });
