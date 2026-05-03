const CJK_REGEX = /[\u4E00-\u9FFF]/;

function isCjkChar(char: string): boolean {
  return CJK_REGEX.test(char);
}

export function estimateTokens(text: string): number {
  if (!text) return 0;

  let cjkCount = 0;
  let otherCount = 0;

  for (const char of text) {
    if (isCjkChar(char)) {
      cjkCount += 1;
    } else {
      otherCount += 1;
    }
  }

  const estimated = cjkCount / 1.5 + otherCount / 4;
  return Math.max(1, Math.round(estimated));
}
