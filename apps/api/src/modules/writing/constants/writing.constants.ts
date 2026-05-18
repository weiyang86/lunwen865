/**
 * Writing 模块运行常量
 */
export const WRITING_HEARTBEAT_INTERVAL_MS = 15000;

export const WRITING_PREVIOUS_TAIL_CHARS = 200;

function parseMaxConsecutiveFailures(): number {
  const raw = process.env.WRITING_MAX_CONSECUTIVE_FAILURES;
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 10) return n;
  return 3;
}

export const WRITING_MAX_CONSECUTIVE_FAILURES = parseMaxConsecutiveFailures();

export const WRITING_SECTION_MAX_TOKENS_DEFAULT = 4096;
