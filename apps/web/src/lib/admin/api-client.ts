'use client';

import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { toast } from 'sonner';
import { adminAuth } from './auth';
import type { ApiError } from './types';

const baseURL =
  (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001').replace(
    /\/$/,
    '',
  ) + '/api';

export const adminApi: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

adminApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = adminAuth.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

type ApiEnvelope = { code: number; data: unknown; message?: string };

function isEnvelope(x: unknown): x is ApiEnvelope {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return typeof r.code === 'number' && 'data' in r;
}

adminApi.interceptors.response.use(
  (response) => {
    const body = response.data as unknown;
    if (isEnvelope(body)) {
      if (body.code === 0 || body.code === 200) {
        response.data = body.data;
        return response;
      }
      const msg = body.message || '请求失败';
      toast.error(msg);
      return Promise.reject({ code: body.code, message: msg } satisfies ApiError);
    }
    return response;
  },
  (error: AxiosError<unknown>) => {
    const status = error.response?.status;
    const respData = error.response?.data as any;
    const serverMsg =
      respData && typeof respData === 'object' && 'message' in respData
        ? String(respData.message)
        : null;
    const msg = serverMsg || error.message || '网络错误';
    const url = error.config?.url;
    const isAuthLoginRequest =
      typeof url === 'string' && url.includes('/auth/login');

    if (status === 401) {
      const shouldTreatAsSessionExpired =
        !isAuthLoginRequest &&
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/admin/login');

      if (shouldTreatAsSessionExpired) {
        adminAuth.removeToken();
        toast.error(
          serverMsg && serverMsg !== 'Unauthorized'
            ? serverMsg
            : '登录已过期，请重新登录',
        );
        const redirect = encodeURIComponent(window.location.pathname);
        window.location.href = `/admin/login?redirect=${redirect}`;
      } else {
        toast.error(
          serverMsg && serverMsg !== 'Unauthorized' ? serverMsg : '账号或密码错误',
        );
      }
    } else if (status === 403) {
      toast.error(
        serverMsg && serverMsg !== 'Forbidden resource' ? serverMsg : '权限不足',
      );
    } else if (status === 429) {
      toast.error(
        serverMsg && serverMsg !== 'Too Many Requests'
          ? serverMsg
          : '请求过于频繁，请稍后再试',
      );
    } else if (status && status >= 500) {
      toast.error(`服务器错误 (${status})`);
    } else {
      toast.error(msg);
    }

    return Promise.reject({
      code: status ?? -1,
      message: msg,
      details: error.response?.data,
    } satisfies ApiError);
  },
);

export const adminHttp = {
  get: <T = unknown>(url: string, params?: unknown) =>
    adminApi.get<T, { data: T }>(url, { params }).then((r) => r.data),
  post: <T = unknown>(url: string, body?: unknown) =>
    adminApi.post<T, { data: T }>(url, body).then((r) => r.data),
  put: <T = unknown>(url: string, body?: unknown) =>
    adminApi.put<T, { data: T }>(url, body).then((r) => r.data),
  patch: <T = unknown>(url: string, body?: unknown) =>
    adminApi.patch<T, { data: T }>(url, body).then((r) => r.data),
  delete: <T = unknown>(url: string) =>
    adminApi.delete<T, { data: T }>(url).then((r) => r.data),
};
