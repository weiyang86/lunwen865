import type { PromptVariable } from '@/types/prompt';

const VAR_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function extractVariableNames(content: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR_REGEX);
  while ((m = re.exec(content)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}

export function mergeVariables(
  contentVars: string[],
  currentVars: PromptVariable[],
): PromptVariable[] {
  const map = new Map(currentVars.map((v) => [v.name, v]));
  return contentVars.map((name) => {
    const exist = map.get(name);
    if (exist) return exist;
    return {
      name,
      label: name,
      type: 'text',
      required: true,
      defaultValue: '',
      description: '',
    };
  });
}

export function diffVariables(
  contentVars: string[],
  currentVars: PromptVariable[],
): { added: string[]; removed: string[] } {
  const curSet = new Set(currentVars.map((v) => v.name));
  const conSet = new Set(contentVars);
  return {
    added: contentVars.filter((n) => !curSet.has(n)),
    removed: currentVars.filter((v) => !conSet.has(v.name)).map((v) => v.name),
  };
}
