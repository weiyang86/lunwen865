function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    backoffMs: number[];
    shouldRetry: (error: unknown) => boolean;
    onRetry?: (attempt: number, error: unknown) => void;
  },
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error: unknown) {
      const canRetry = options.shouldRetry(error);
      const remaining = options.maxRetries - attempt;

      if (!canRetry || remaining <= 0) {
        throw error;
      }

      const backoff =
        options.backoffMs[Math.min(attempt, options.backoffMs.length - 1)] ?? 0;
      attempt += 1;

      options.onRetry?.(attempt, error);
      if (backoff > 0) {
        await sleep(backoff);
      }
    }
  }
}
