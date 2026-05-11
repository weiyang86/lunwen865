'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientHttp } from '@/lib/client/api-client';
import { clientAuth } from '@/lib/client/auth';

type LoginResponse = {
  token: string;
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    nickname?: string | null;
    role?: string;
  };
};

export function ClientLoginForm({
  redirect,
  sessionError,
}: {
  redirect: string;
  sessionError: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    sessionError ? '登录已失效，请重新登录。' : null,
  );

  const validationError = useMemo(() => {
    if (!email.trim()) return '请输入邮箱';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return '邮箱格式不正确';
    if (!password) return '请输入密码';
    if (password.length < 6) return '密码至少 6 位';
    return null;
  }, [email, password]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const data = await clientHttp.post<LoginResponse>('/auth/login', {
        email: email.trim(),
        password,
      });

      clientAuth.setToken(data.token);
      clientAuth.setUser(data.user);
      router.replace(redirect);
    } catch (err: unknown) {
      const fallback = '登录失败，请检查邮箱或密码';
      const msg =
        typeof err === 'object' && err && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ??
            fallback)
          : fallback;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">客户登录</h1>
      <p className="mt-2 text-sm text-slate-600">登录后可查看订单、任务与下载交付。</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">邮箱</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
            disabled={submitting}
          />
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '登录中...' : '登录'}
        </button>
      </form>
    </section>
  );
}
