'use client';

export type DiffOp =
  | { type: 'eq'; left: string; right: string; leftNo: number; rightNo: number }
  | { type: 'del'; left: string; leftNo: number }
  | { type: 'add'; right: string; rightNo: number };

type AlignedLeft = { no: number | null; text: string; type: 'eq' | 'del' | 'placeholder' };
type AlignedRight = { no: number | null; text: string; type: 'eq' | 'add' | 'placeholder' };

export function diffLines(a: string, b: string): DiffOp[] {
  const left = a.split('\n');
  const right = b.split('\n');

  if (left.length > 5000 || right.length > 5000) {
    const ops: DiffOp[] = [];
    for (let i = 0; i < left.length; i += 1) ops.push({ type: 'del', left: left[i], leftNo: i + 1 });
    for (let j = 0; j < right.length; j += 1)
      ops.push({ type: 'add', right: right[j], rightNo: j + 1 });
    return ops;
  }

  const n = left.length;
  const m = right.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = left[i] === right[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      ops.push({ type: 'eq', left: left[i], right: right[j], leftNo: i + 1, rightNo: j + 1 });
      i += 1;
      j += 1;
      continue;
    }
    if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'del', left: left[i], leftNo: i + 1 });
      i += 1;
    } else {
      ops.push({ type: 'add', right: right[j], rightNo: j + 1 });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: 'del', left: left[i], leftNo: i + 1 });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: 'add', right: right[j], rightNo: j + 1 });
    j += 1;
  }
  return ops;
}

export function alignDiffOps(ops: DiffOp[]): { left: AlignedLeft[]; right: AlignedRight[] } {
  const left: AlignedLeft[] = [];
  const right: AlignedRight[] = [];
  for (const op of ops) {
    if (op.type === 'eq') {
      left.push({ no: op.leftNo, text: op.left, type: 'eq' });
      right.push({ no: op.rightNo, text: op.right, type: 'eq' });
    } else if (op.type === 'del') {
      left.push({ no: op.leftNo, text: op.left, type: 'del' });
      right.push({ no: null, text: '', type: 'placeholder' });
    } else {
      left.push({ no: null, text: '', type: 'placeholder' });
      right.push({ no: op.rightNo, text: op.right, type: 'add' });
    }
  }
  return { left, right };
}

