import { z } from 'zod';

export const TOPIC_GENERATION_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      minItems: 3,
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 8, maxLength: 100 },
          rationale: { type: 'string', minLength: 20, maxLength: 500 },
          keywords: {
            type: 'array',
            minItems: 2,
            maxItems: 8,
            items: { type: 'string' },
          },
          estimatedDifficulty: {
            type: 'string',
            enum: ['EASY', 'MEDIUM', 'HARD'],
          },
        },
        required: ['title', 'rationale', 'keywords', 'estimatedDifficulty'],
        additionalProperties: false,
      },
    },
  },
  required: ['candidates'],
  additionalProperties: false,
} as const;

export const TOPIC_GENERATION_ZOD_SCHEMA = z.object({
  candidates: z
    .array(
      z.object({
        title: z.string().min(8).max(100),
        rationale: z.string().min(20).max(500),
        keywords: z.array(z.string()).min(2).max(8),
        estimatedDifficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
      }),
    )
    .min(3)
    .max(10),
});
