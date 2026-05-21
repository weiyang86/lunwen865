'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type AuthResultResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: LoginResponse['user'];
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
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [registerMethod, setRegisterMethod] = useState<'email' | 'phone'>(
    'email',
  );
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [emailCodeCountdown, setEmailCodeCountdown] = useState(0);
  const [phoneCodeCountdown, setPhoneCodeCountdown] = useState(0);
  const [sendingLoginPhoneCode, setSendingLoginPhoneCode] = useState(false);
  const [loginPhoneCodeCountdown, setLoginPhoneCodeCountdown] = useState(0);
  const [error, setError] = useState<string | null>(
    sessionError ? '登录已失效，请重新登录。' : null,
  );
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setCode('');
    setPassword('');
    setConfirmPassword('');
    setError(sessionError ? '登录已失效，请重新登录。' : null);
    setHint(null);
  }, [mode, sessionError]);

  useEffect(() => {
    if (emailCodeCountdown <= 0) return;
    const t = window.setInterval(() => {
      setEmailCodeCountdown((s) => Math.max(s - 1, 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [emailCodeCountdown]);

  useEffect(() => {
    if (phoneCodeCountdown <= 0) return;
    const t = window.setInterval(() => {
      setPhoneCodeCountdown((s) => Math.max(s - 1, 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [phoneCodeCountdown]);

  useEffect(() => {
    if (loginPhoneCodeCountdown <= 0) return;
    const t = window.setInterval(() => {
      setLoginPhoneCodeCountdown((s) => Math.max(s - 1, 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [loginPhoneCodeCountdown]);

  const validationError = useMemo(() => {
    if (mode === 'register') {
      if (registerMethod === 'email') {
        if (!email.trim()) return '请输入邮箱';
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) return '邮箱格式不正确';
        if (!code.trim()) return '请输入验证码';
        if (!/^\d{6}$/.test(code.trim())) return '验证码为 6 位数字';
        if (!password) return '请输入密码';
        if (password.length < 8) return '密码至少 8 位';
        if (!confirmPassword) return '请再次输入密码';
        if (password !== confirmPassword) return '两次输入的密码不一致';
        return null;
      }

      if (!phone.trim()) return '请输入手机号';
      if (!/^1[3-9]\d{9}$/.test(phone.trim())) return '手机号格式不正确';
      if (!code.trim()) return '请输入验证码';
      if (!/^\d{6}$/.test(code.trim())) return '验证码为 6 位数字';
      if (password) {
        if (password.length < 8) return '密码至少 8 位';
        if (!confirmPassword) return '请再次输入密码';
        if (password !== confirmPassword) return '两次输入的密码不一致';
      }
      return null;
    }
    if (loginMethod === 'email') {
      if (!email.trim()) return '请输入邮箱';
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return '邮箱格式不正确';
      if (!password) return '请输入密码';
      if (password.length < 6) return '密码至少 6 位';
      return null;
    }
    if (!phone.trim()) return '请输入手机号';
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) return '手机号格式不正确';
    if (!code.trim()) return '请输入验证码';
    if (!/^\d{6}$/.test(code.trim())) return '验证码为 6 位数字';
    return null;
  }, [code, confirmPassword, email, loginMethod, mode, password, phone, registerMethod]);

  const canSendEmailCode = useMemo(() => {
    return /^\S+@\S+\.\S+$/.test(email.trim());
  }, [email]);

  const canSendPhoneCode = useMemo(() => {
    return /^1[3-9]\d{9}$/.test(phone.trim());
  }, [phone]);

  const sendRegisterCode = async () => {
    if (mode !== 'register') return;
    setError(null);
    setHint(null);

    if (registerMethod === 'email') {
      if (sendingEmailCode || emailCodeCountdown > 0) return;
      if (!canSendEmailCode) {
        setError('请输入正确的邮箱后再发送验证码');
        return;
      }
      try {
        setSendingEmailCode(true);
        await clientHttp.post<{ ok: true }>('/auth/send-code', {
          target: email.trim(),
          type: 'email',
          scene: 'REGISTER',
        });
        setEmailCodeCountdown(60);
        setHint('验证码已发送，请检查邮箱（含垃圾箱）。');
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, '发送验证码失败，请稍后再试。'));
      } finally {
        setSendingEmailCode(false);
      }
      return;
    }

    if (sendingPhoneCode || phoneCodeCountdown > 0) return;
    if (!canSendPhoneCode) {
      setError('请输入正确的手机号后再发送验证码');
      return;
    }
    try {
      setSendingPhoneCode(true);
      await clientHttp.post<{ ok: true }>('/auth/send-code', {
        target: phone.trim(),
        type: 'phone',
        scene: 'REGISTER',
      });
      setPhoneCodeCountdown(60);
      setHint('验证码已发送，请注意查收短信。');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '发送验证码失败，请稍后再试。'));
    } finally {
      setSendingPhoneCode(false);
    }
  };

  const sendLoginPhoneCode = async () => {
    if (mode !== 'login') return;
    if (loginMethod !== 'phone') return;
    setError(null);
    setHint(null);

    if (sendingLoginPhoneCode || loginPhoneCodeCountdown > 0) return;
    if (!canSendPhoneCode) {
      setError('请输入正确的手机号后再发送验证码');
      return;
    }
    try {
      setSendingLoginPhoneCode(true);
      await clientHttp.post<{ ok: true }>('/auth/send-code', {
        target: phone.trim(),
        type: 'phone',
        scene: 'LOGIN',
      });
      setLoginPhoneCodeCountdown(60);
      setHint('验证码已发送，请注意查收短信。');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '发送验证码失败，请稍后再试。'));
    } finally {
      setSendingLoginPhoneCode(false);
    }
  };

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
      setHint(null);

      if (mode === 'register') {
        const data = await clientHttp.post<{
          user: LoginResponse['user'];
          accessToken: string;
        }>('/auth/register', {
          email: registerMethod === 'email' ? email.trim() : undefined,
          phone: registerMethod === 'phone' ? phone.trim() : undefined,
          code: code.trim(),
          password: password || undefined,
          nickname: nickname.trim() || undefined,
          registerChannel: 'web',
        });
        clientAuth.setToken(data.accessToken);
        clientAuth.setUser(data.user);
        router.replace('/tasks');
      } else if (loginMethod === 'phone') {
        const data = await clientHttp.post<AuthResultResponse>(
          '/auth/login/phone-code',
          {
            phone: phone.trim(),
            code: code.trim(),
          },
        );
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
    <section className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
        <h1 className="text-xl font-semibold tracking-tight">欢迎使用论文通</h1>
        <p className="mt-1 text-sm text-slate-600">
          {mode === 'register'
            ? '完成验证后即可进入任务界面开始使用。'
            : '登录后可查看订单、任务与下载交付。'}
        </p>
      </div>

      <div className="space-y-4 px-6 py-6">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 font-medium ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => setMode('login')}
            disabled={submitting}
          >
            登录
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 font-medium ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => setMode('register')}
            disabled={submitting}
          >
            注册
          </button>
        </div>

        {mode === 'login' ? (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm">
            <button
              type="button"
              className={`rounded-lg px-3 py-2 font-medium ${loginMethod === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              onClick={() => {
                setLoginMethod('email');
                setCode('');
              }}
              disabled={submitting}
            >
              邮箱登录
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-2 font-medium ${loginMethod === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              onClick={() => {
                setLoginMethod('phone');
                setPassword('');
                setConfirmPassword('');
              }}
              disabled={submitting}
            >
              手机登录
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm">
            <button
              type="button"
              className={`rounded-lg px-3 py-2 font-medium ${registerMethod === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              onClick={() => {
                setRegisterMethod('email');
                setCode('');
              }}
              disabled={submitting}
            >
              邮箱注册
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-2 font-medium ${registerMethod === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              onClick={() => {
                setRegisterMethod('phone');
                setCode('');
              }}
              disabled={submitting}
            >
              手机注册
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'register' ? (
            <div className="grid gap-2">
              <Label htmlFor="nickname">昵称（可选）</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="例如：小李同学"
                disabled={submitting}
              />
            </div>
          ) : null}

          {mode === 'login' && loginMethod === 'email' ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="login-email">邮箱</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={submitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="login-password">密码</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  disabled={submitting}
                />
              </div>
            </div>
          ) : null}

          {mode === 'login' && loginMethod === 'phone' ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="login-phone">手机号</Label>
                <Input
                  id="login-phone"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="例如：13800138000"
                  disabled={submitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="login-code">验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="login-code"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6 位数字"
                    disabled={submitting}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void sendLoginPhoneCode()}
                    disabled={
                      submitting ||
                      sendingLoginPhoneCode ||
                      loginPhoneCodeCountdown > 0
                    }
                  >
                    {loginPhoneCodeCountdown > 0
                      ? `${loginPhoneCodeCountdown}s`
                      : sendingLoginPhoneCode
                        ? '发送中...'
                        : '发送验证码'}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {mode === 'register' && registerMethod === 'email' ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="reg-email">邮箱</Label>
                <Input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={submitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reg-email-code">验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="reg-email-code"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6 位数字"
                    disabled={submitting}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void sendRegisterCode()}
                    disabled={submitting || sendingEmailCode || emailCodeCountdown > 0}
                  >
                    {emailCodeCountdown > 0
                      ? `${emailCodeCountdown}s`
                      : sendingEmailCode
                        ? '发送中...'
                        : '发送验证码'}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reg-email-password">设置密码</Label>
                <Input
                  id="reg-email-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 8 位"
                  disabled={submitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reg-email-confirm">确认密码</Label>
                <Input
                  id="reg-email-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入"
                  disabled={submitting}
                />
              </div>
            </div>
          ) : null}

          {mode === 'register' && registerMethod === 'phone' ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="reg-phone">手机号</Label>
                <Input
                  id="reg-phone"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="例如：13800138000"
                  disabled={submitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reg-phone-code">验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="reg-phone-code"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6 位数字"
                    disabled={submitting}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void sendRegisterCode()}
                    disabled={submitting || sendingPhoneCode || phoneCodeCountdown > 0}
                  >
                    {phoneCodeCountdown > 0
                      ? `${phoneCodeCountdown}s`
                      : sendingPhoneCode
                        ? '发送中...'
                        : '发送验证码'}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reg-phone-password">设置密码（可选）</Label>
                <Input
                  id="reg-phone-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="留空可使用短信验证码登录"
                  disabled={submitting}
                />
              </div>
              {password ? (
                <div className="grid gap-2">
                  <Label htmlFor="reg-phone-confirm">确认密码</Label>
                  <Input
                    id="reg-phone-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入"
                    disabled={submitting}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {hint ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {hint}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (mode === 'register' ? '注册中...' : '登录中...') : mode === 'register' ? '注册并进入任务' : '登录'}
          </Button>
        </form>
      </div>
    </section>
  );
}
