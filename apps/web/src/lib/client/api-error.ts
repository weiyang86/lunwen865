export type ApiErrorLike = {
  response?: {
    data?: {
      message?: string | string[];
      code?: string;
    };
    status?: number;
  };
  message?: string;
};

const DEFAULT_ERROR_MESSAGE = '请求失败，请稍后重试。';

export function getApiErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const apiError = error as ApiErrorLike;
  const responseMessage = apiError.response?.data?.message;

  if (Array.isArray(responseMessage)) {
    const merged = responseMessage.map((item) => item.trim()).filter(Boolean).join('；');
    if (merged) return merged;
  }

  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return responseMessage.trim();
  }

  if (typeof apiError.message === 'string' && apiError.message.trim()) {
    return apiError.message.trim();
  }

  return fallback;
}
