import { BadRequestException } from '@nestjs/common';

export interface PromptVariable {
  name: string;
  label?: string;
  required?: boolean;
  defaultValue?: string;
  description?: string;
}

function toPromptValueString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'bigint') return String(val);
  if (val === null) return 'null';
  if (val === undefined) return '';
  try {
    return JSON.stringify(val);
  } catch {
    throw new BadRequestException('Prompt 变量无法序列化');
  }
}

export function renderPrompt(
  template: string,
  declaredVars: PromptVariable[],
  vars: Record<string, unknown>,
): string {
  const declared = declaredVars ?? [];
  for (const v of declared) {
    const val = vars[v.name];
    if (v.required && (val === undefined || val === '')) {
      if (v.defaultValue === undefined) {
        throw new BadRequestException(`Prompt 变量缺失: ${v.name}`);
      }
    }
  }

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name: string) => {
    const val = vars[name];
    if (val !== undefined) return toPromptValueString(val);
    const decl = declared.find((d) => d.name === name);
    if (decl?.defaultValue !== undefined) return decl.defaultValue;
    return `{{${name}}}`;
  });
}
