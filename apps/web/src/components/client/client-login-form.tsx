'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientHttp } from '@/lib/client/api-client';
import { getApiErrorMessage } from '@/lib/client/api-error';
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
  initialMode = 'login',
}: {
  redirect: string;
  sessionError: boolean;
  initialMode?: 'login' | 'register';
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    sessionError ? '登录已失效，请重新登录。' : null,
  );

  const validationError = useMemo(() => {
    if (mode === 'register') {
      if (!email.trim()) return '请输入邮箱';
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return '邮箱格式不正确';
      if (!password) return '请输入密码';
      if (password.length < 8) return '密码至少 8 位';
      if (!confirmPassword) return '请再次输入密码';
      if (password !== confirmPassword) return '两次输入的密码不一致';
      return null;
    }
    if (!email.trim()) return '请输入邮箱';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return '邮箱格式不正确';
    if (!password) return '请输入密码';
    if (password.length < 6) return '密码至少 6 位';
    return null;
  }, [confirmPassword, email, mode, password]);

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

      if (mode === 'register') {
        const data = await clientHttp.post<{
          user: LoginResponse['user'];
          accessToken: string;
        }>('/auth/register', {
          email: email.trim(),
          password,
          nickname: nickname.trim() || undefined,
          registerChannel: 'web',
        });
        clientAuth.setToken(data.accessToken);
        clientAuth.setUser(data.user);
        router.replace(redirect);
      } else {
        const data = await clientHttp.post<LoginResponse>('/auth/login', {
          email: email.trim(),
          password,
        });

        clientAuth.setToken(data.token);
        clientAuth.setUser(data.user);
        router.replace(redirect);
      }
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(
          err,
          mode === 'register'
            ? '注册失败，请检查邮箱与密码。'
            : '登录失败，请检查邮箱或密码。',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">论文通</h1>
      <p className="mt-2 text-sm text-slate-600">
        {mode === 'register'
          ? '注册普通学生账号后即可开始创建论文任务。'
          : '登录后可查看订单、任务与下载交付。'}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm">
        <button
          type="button"
          className={`rounded-lg px-3 py-2 font-medium ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => {
            setError(null);
            setMode('login');
          }}
          disabled={submitting}
        >
          登录
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-2 font-medium ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => {
            setError(null);
            setMode('register');
          }}
          disabled={submitting}
        >
          注册
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {mode === 'register' ? (
          <div>
            <label className="mb-1 block text-sm font-medium">昵称（可选）</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="例如：小李同学"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
              disabled={submitting}
            />
          </div>
        ) : null}

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

        {mode === 'register' ? (
          <div>
            <label className="mb-1 block text-sm font-medium">确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入密码"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
              disabled={submitting}
            />
          </div>
        ) : null}

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
          {submitting
            ? mode === 'register'
              ? '注册中...'
              : '登录中...'
            : mode === 'register'
              ? '注册'
              : '登录'}
        </button>
      </form>
    </section>
  );
}
