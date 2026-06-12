'use client';

import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { clientAuth } from './auth';

const baseURL = '/api';

export const clientApi: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

clientApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = clientAuth.getToken();
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

clientApi.interceptors.response.use(
  (r) => r,
  (error: AxiosError<unknown>) => {
    const status = error.response?.status;
    const url = typeof error.config?.url === 'string' ? error.config.url : '';
    const ignoreAuthClear =
      url.includes('/payment/orders/') || url.includes('/orders/') && url.includes('/payment-status');

    if (status === 401 && !ignoreAuthClear) {
      clientAuth.clearToken();
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/login')
      ) {
        const redirect = encodeURIComponent(window.location.pathname);
        window.location.href = `/login?redirect=${redirect}&error=session`;
      }
    }
    return Promise.reject(error);
  },
);

export const clientHttp = {
  get: <T = unknown>(url: string, params?: unknown) =>
    clientApi.get<T, { data: T }>(url, { params }).then((r) => r.data),
  post: <T = unknown>(url: string, body?: unknown) =>
    clientApi.post<T, { data: T }>(url, body).then((r) => r.data),
  patch: <T = unknown>(url: string, body?: unknown) =>
    clientApi.patch<T, { data: T }>(url, body).then((r) => r.data),
  delete: <T = unknown>(url: string) =>
    clientApi.delete<T, { data: T }>(url).then((r) => r.data),
};
