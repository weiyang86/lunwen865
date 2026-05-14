'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { clientHttp } from '@/lib/client/api-client';
import { clientAuth, type ClientUser } from '@/lib/client/auth';
import { getApiErrorMessage } from '@/lib/client/api-error';

type SafeUser = {
  id: string;
  phone?: string | null;
  email?: string | null;
  nickname?: string | null;
  realName?: string | null;
  school?: string | null;
  major?: string | null;
  educationLevel?: 'UNDERGRADUATE' | 'MASTER' | 'DOCTOR' | 'OTHER' | null;
  grade?: string | null;
  role?: string | null;
};

type WordQuota = { total: number; used: number; remaining: number };
type QuotaBalances = Record<
  'PAPER_GENERATION' | 'POLISH' | 'EXPORT' | 'AI_CHAT',
  number
>;

const EDUCATION_LEVEL_OPTIONS: Array<{
  value: NonNullable<SafeUser['educationLevel']>;
  label: string;
}> = [
  { value: 'UNDERGRADUATE', label: '本科' },
  { value: 'MASTER', label: '硕士' },
  { value: 'DOCTOR', label: '博士' },
  { value: 'OTHER', label: '其他' },
];

function isAdminRole(role?: string | null) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export default function AccountPage() {
  const cached = useMemo(() => clientAuth.getUser(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [wordQuota, setWordQuota] = useState<WordQuota | null>(null);
  const [balances, setBalances] = useState<QuotaBalances | null>(null);

  const [nickname, setNickname] = useState(cached?.nickname ?? '');
  const [realName, setRealName] = useState('');
  const [school, setSchool] = useState('');
  const [major, setMajor] = useState('');
  const [educationLevel, setEducationLevel] =
    useState<SafeUser['educationLevel']>('UNDERGRADUATE');
  const [grade, setGrade] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [grantType, setGrantType] =
    useState<keyof QuotaBalances>('PAPER_GENERATION');
  const [grantAmount, setGrantAmount] = useState(1);
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [me, q, b] = await Promise.all([
        clientHttp.get<SafeUser | null>('/users/me'),
        clientHttp.get<WordQuota>('/users/me/quota'),
        clientHttp.get<QuotaBalances>('/quota/me'),
      ]);

      setUser(me);
      setWordQuota(q);
      setBalances(b);

      if (me) {
        setNickname(me.nickname ?? '');
        setRealName(me.realName ?? '');
        setSchool(me.school ?? '');
        setMajor(me.major ?? '');
        setEducationLevel(me.educationLevel ?? 'UNDERGRADUATE');
        setGrade(me.grade ?? '');

        const cachedUser: ClientUser = {
          id: me.id,
          email: me.email ?? undefined,
          phone: me.phone ?? undefined,
          nickname: me.nickname ?? undefined,
          role: me.role ?? undefined,
        };
        clientAuth.setUser(cachedUser);
      }
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, '加载账户信息失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canEdit = !!user;
  const canGrant = isAdminRole(user?.role);

  const profilePayload = useMemo(() => {
    return {
      nickname: nickname.trim() || undefined,
      realName: realName.trim() || undefined,
      school: school.trim() || undefined,
      major: major.trim() || undefined,
      educationLevel: educationLevel || undefined,
      grade: grade.trim() || undefined,
    };
  }, [educationLevel, grade, major, nickname, realName, school]);

  const onSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    if (saving) return;

    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(null);
      const updated = await clientHttp.patch<SafeUser>('/users/me', profilePayload);
      setUser(updated);
      setSaveSuccess('个人信息已保存。');

      const cachedUser: ClientUser = {
        id: updated.id,
        email: updated.email ?? undefined,
        phone: updated.phone ?? undefined,
        nickname: updated.nickname ?? undefined,
        role: updated.role ?? undefined,
      };
      clientAuth.setUser(cachedUser);
    } catch (e: unknown) {
      setSaveError(getApiErrorMessage(e, '保存失败，请稍后重试。'));
    } finally {
      setSaving(false);
    }
  };

  const onGrant = async (mode: 'grant' | 'deduct') => {
    if (!user) return;
    if (!canGrant) return;
    if (granting) return;
    if (!Number.isFinite(grantAmount) || grantAmount <= 0) {
      setGrantError('数量必须大于 0。');
      return;
    }

    try {
      setGranting(true);
      setGrantError(null);
      setGrantSuccess(null);
      const url = mode === 'grant' ? '/admin/quota/grant' : '/admin/quota/deduct';
      await clientHttp.post(url, {
        userId: user.id,
        type: grantType,
        amount: Math.floor(grantAmount),
        remark: 'account page',
      });
      setGrantSuccess(mode === 'grant' ? '已发放配额。' : '已扣减配额。');
      await refresh();
    } catch (e: unknown) {
      setGrantError(getApiErrorMessage(e, '操作失败，请稍后重试。'));
    } finally {
      setGranting(false);
    }
  };

  if (loading) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">账户中心</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          加载中...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">账户中心</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          重试
        </button>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">账户中心</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          暂无账户信息
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">账户中心</h1>
          <p className="text-sm text-slate-600">完善个人资料与查看配额信息。</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          刷新
        </button>
      </header>

      <form
        onSubmit={onSaveProfile}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2"
      >
        <h2 className="md:col-span-2 text-lg font-medium">个人信息</h2>

        <div className="text-sm">
          <div className="text-slate-500">用户 ID</div>
          <div className="mt-1 break-all font-mono text-xs">{user.id}</div>
        </div>

        <div className="text-sm">
          <div className="text-slate-500">角色</div>
          <div className="mt-1">{user.role || 'USER'}</div>
        </div>

        <div className="text-sm">
          <div className="text-slate-500">邮箱</div>
          <div className="mt-1">{user.email || '-'}</div>
        </div>

        <div className="text-sm">
          <div className="text-slate-500">手机号</div>
          <div className="mt-1">{user.phone || '-'}</div>
        </div>

        <label className="text-sm">
          昵称（选填）
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            disabled={!canEdit || saving}
            maxLength={20}
          />
        </label>

        <label className="text-sm">
          真实姓名（选填）
          <input
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            disabled={!canEdit || saving}
            maxLength={20}
          />
        </label>

        <label className="text-sm">
          学校（选填）
          <input
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            disabled={!canEdit || saving}
            maxLength={50}
          />
        </label>

        <label className="text-sm">
          专业（选填）
          <input
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            disabled={!canEdit || saving}
            maxLength={50}
          />
        </label>

        <label className="text-sm">
          学历层次（选填）
          <select
            value={educationLevel ?? 'UNDERGRADUATE'}
            onChange={(e) =>
              setEducationLevel(e.target.value as SafeUser['educationLevel'])
            }
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            disabled={!canEdit || saving}
          >
            {EDUCATION_LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          年级（选填）
          <input
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            disabled={!canEdit || saving}
            maxLength={50}
          />
        </label>

        {saveError ? (
          <p className="md:col-span-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {saveError}
          </p>
        ) : null}
        {saveSuccess ? (
          <p className="md:col-span-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {saveSuccess}
          </p>
        ) : null}

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={!canEdit || saving}
            className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-medium">配额信息</h2>

        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="text-slate-500">论文生成次数</div>
          <div className="mt-1 text-lg font-semibold">
            {balances?.PAPER_GENERATION ?? 0}
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="text-slate-500">润色次数</div>
          <div className="mt-1 text-lg font-semibold">{balances?.POLISH ?? 0}</div>
        </div>

        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="text-slate-500">导出次数</div>
          <div className="mt-1 text-lg font-semibold">{balances?.EXPORT ?? 0}</div>
        </div>

        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="text-slate-500">AI 对话次数</div>
          <div className="mt-1 text-lg font-semibold">{balances?.AI_CHAT ?? 0}</div>
        </div>

        <div className="md:col-span-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="text-slate-500">字数额度</div>
          <div className="mt-1 flex flex-wrap gap-4">
            <span>总量：{wordQuota?.total ?? 0}</span>
            <span>已用：{wordQuota?.used ?? 0}</span>
            <span>剩余：{wordQuota?.remaining ?? 0}</span>
          </div>
        </div>

        <div className="md:col-span-2 text-sm text-slate-600">
          配额通常来自下单/支付后的自动发放；如需测试可联系管理员发放。
          <Link href="/products" className="ml-2 underline underline-offset-4">
            前往购买
          </Link>
        </div>
      </section>

      {canGrant ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-medium">配额调整（管理员）</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              类型
              <select
                value={grantType}
                onChange={(e) => setGrantType(e.target.value as keyof QuotaBalances)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                disabled={granting}
              >
                <option value="PAPER_GENERATION">论文生成</option>
                <option value="POLISH">润色</option>
                <option value="EXPORT">导出</option>
                <option value="AI_CHAT">AI 对话</option>
              </select>
            </label>
            <label className="text-sm">
              数量
              <input
                type="number"
                min={1}
                value={grantAmount}
                onChange={(e) => setGrantAmount(Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                disabled={granting}
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => void onGrant('grant')}
                disabled={granting}
                className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                发放
              </button>
              <button
                type="button"
                onClick={() => void onGrant('deduct')}
                disabled={granting}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-60"
              >
                扣减
              </button>
            </div>
          </div>
          {grantError ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {grantError}
            </div>
          ) : null}
          {grantSuccess ? (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {grantSuccess}
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
