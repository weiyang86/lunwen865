import { QueryClient } from '@tanstack/react-query';

import type { ApiError } from './types';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error: unknown) => {
          const code = (error as Partial<ApiError> | null)?.code;
          if (code && [401, 403, 404].includes(code)) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
