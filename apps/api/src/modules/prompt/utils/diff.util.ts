export type LineDiffChunk = {
  added?: boolean;
  removed?: boolean;
  value: string;
};

function splitLines(text: string): string[] {
  return (text ?? '').split(/\r?\n/);
}

export function diffLines(from: string, to: string): LineDiffChunk[] {
  const a = splitLines(from);
  const b = splitLines(to);

  const n = a.length;
  const m = b.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: LineDiffChunk[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ value: `${a[i]}\n` });
      i += 1;
      j += 1;
      continue;
    }
    if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ removed: true, value: `${a[i]}\n` });
      i += 1;
      continue;
    }
    out.push({ added: true, value: `${b[j]}\n` });
    j += 1;
  }

  while (i < n) {
    out.push({ removed: true, value: `${a[i]}\n` });
    i += 1;
  }
  while (j < m) {
    out.push({ added: true, value: `${b[j]}\n` });
    j += 1;
  }

  return out;
}
