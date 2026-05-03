'use client';

import { useCallback, useMemo } from 'react';

import type { PromptVariable } from '@/types/prompt';
import { diffVariables, extractVariableNames, mergeVariables } from '../utils/parseVariables';

export function useExtractVariables(content: string, variables: PromptVariable[]): {
  contentVars: string[];
  diff: { added: string[]; removed: string[] };
  hasDiff: boolean;
  syncToVariables: () => PromptVariable[];
} {
  const contentVars = useMemo(() => extractVariableNames(content), [content]);

  const diff = useMemo(() => diffVariables(contentVars, variables), [contentVars, variables]);

  const hasDiff = diff.added.length > 0 || diff.removed.length > 0;

  const syncToVariables = useCallback(
    () => mergeVariables(contentVars, variables),
    [contentVars, variables],
  );

  return { contentVars, diff, hasDiff, syncToVariables };
}

