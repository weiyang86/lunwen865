'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminHttp } from '@/lib/admin/api-client';

type DeploymentEnv = {
  key: string;
  name: string;
  webBaseUrl?: string;
  apiBaseUrl?: string;
  webhookBaseUrl?: string;
  certsDir?: string;
};

type ComputedNotifyUrls = {
  wechatPayNotifyUrl: string | null;
  wechatRefundNotifyUrl: string | null;
  alipayPayNotifyUrl: string | null;
  alipayRefundNotifyUrl: string | null;
  certsDir?: string | null;
  wechatPrivateKeyPathExample?: string | null;
  alipayPrivateKeyPathExample?: string | null;
  alipayPublicKeyPathExample?: string | null;
};

type EnvResp = {
  envs: DeploymentEnv[];
  computed: Record<string, ComputedNotifyUrls>;
};

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

export default function AdminDeploymentEnvsPage() {
  const [loading, setLoading] = useState(false);
  const [envs, setEnvs] = useState<DeploymentEnv[]>([]);
  const [computed, setComputed] = useState<Record<string, ComputedNotifyUrls>>(
    {},
  );

  async function loadAll() {
    setLoading(true);
    try {
      const res = await adminHttp.get<EnvResp>('/admin/deployments/envs');
      setEnvs(res.envs ?? []);
      setComputed(res.computed ?? {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const drafts = useMemo(() => {
    return envs.map((e) => ({
      key: e.key,
      name: e.name,
      webBaseUrl: e.webBaseUrl ?? '',
      apiBaseUrl: e.apiBaseUrl ?? '',
      webhookBaseUrl: e.webhookBaseUrl ?? '',
      certsDir: e.certsDir ?? '',
    }));
  }, [envs]);

  const [form, setForm] = useState(drafts);

  useEffect(() => {
    setForm(drafts);
  }, [drafts]);

  function updateRow(idx: number, patch: Partial<DeploymentEnv>) {
    setForm((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)),
    );
  }

  async function save() {
    const next = form
      .map((e) => ({
        key: e.key.trim(),
        name: e.name.trim() || e.key.trim(),
        webBaseUrl: normalizeBaseUrl(e.webBaseUrl ?? ''),
        apiBaseUrl: normalizeBaseUrl(e.apiBaseUrl ?? ''),
        webhookBaseUrl: normalizeBaseUrl(e.webhookBaseUrl ?? ''),
        certsDir: (e.certsDir ?? '').trim().replace(/\/$/, ''),
      }))
      .filter((e) => e.key);

    if (next.length === 0) {
      toast.error('至少需要配置一个环境');
      return;
    }

    const bad = next.find(
      (e) =>
        (e.webBaseUrl && !/^https?:\/\//i.test(e.webBaseUrl)) ||
        (e.apiBaseUrl && !/^https?:\/\//i.test(e.apiBaseUrl)) ||
        (e.webhookBaseUrl && !/^https?:\/\//i.test(e.webhookBaseUrl)),
    );
    if (bad) {
      toast.error('BaseUrl 必须以 http:// 或 https:// 开头');
      return;
    }

    setLoading(true);
    try {
      const res = await adminHttp.put<EnvResp>('/admin/deployments/envs', {
        envs: next,
      });
      setEnvs(res.envs ?? []);
      setComputed(res.computed ?? {});
      toast.success('已保存');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string | null) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success('已复制');
    } catch {
      toast.error('复制失败');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">环境配置</h1>
          <p className="text-sm text-slate-500">
            用于统一管理对外域名与回调地址，方便支付参数填写
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAll} disabled={loading}>
            刷新
          </Button>
          <Button onClick={save} disabled={loading}>
            保存
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>环境</TableHead>
              <TableHead>Web BaseUrl</TableHead>
              <TableHead>API BaseUrl</TableHead>
              <TableHead>Webhook BaseUrl</TableHead>
              <TableHead>证书目录</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {form.map((e, idx) => (
              <TableRow key={e.key || idx}>
                <TableCell className="align-top">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-slate-900">
                      {e.name || e.key || '未命名'}
                    </div>
                    <Input
                      value={e.name}
                      onChange={(ev) =>
                        updateRow(idx, { name: ev.target.value })
                      }
                      disabled={loading}
                      placeholder="显示名称"
                    />
                    <Input
                      value={e.key}
                      onChange={(ev) =>
                        updateRow(idx, { key: ev.target.value })
                      }
                      disabled={loading}
                      placeholder="key，例如 prod"
                    />
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="space-y-2">
                    <Label className="sr-only">Web BaseUrl</Label>
                    <Input
                      value={e.webBaseUrl}
                      onChange={(ev) =>
                        updateRow(idx, { webBaseUrl: ev.target.value })
                      }
                      disabled={loading}
                      placeholder="https://example.com"
                    />
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="space-y-2">
                    <Label className="sr-only">API BaseUrl</Label>
                    <Input
                      value={e.apiBaseUrl}
                      onChange={(ev) =>
                        updateRow(idx, { apiBaseUrl: ev.target.value })
                      }
                      disabled={loading}
                      placeholder="https://api.example.com"
                    />
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="space-y-2">
                    <Label className="sr-only">Webhook BaseUrl</Label>
                    <Input
                      value={e.webhookBaseUrl}
                      onChange={(ev) =>
                        updateRow(idx, { webhookBaseUrl: ev.target.value })
                      }
                      disabled={loading}
                      placeholder="https://api.example.com"
                    />
                    <div className="space-y-1 text-xs text-slate-500">
                      <div>
                        用于生成支付回调地址（优先 webhook，其次 api）
                      </div>
                      <div>
                        微信回调：
                        <button
                          className="ml-1 underline"
                          onClick={() =>
                            copy(computed[e.key]?.wechatPayNotifyUrl ?? null)
                          }
                          disabled={loading}
                          type="button"
                        >
                          {computed[e.key]?.wechatPayNotifyUrl ?? '—'}
                        </button>
                      </div>
                      <div>
                        支付宝回调：
                        <button
                          className="ml-1 underline"
                          onClick={() =>
                            copy(computed[e.key]?.alipayPayNotifyUrl ?? null)
                          }
                          disabled={loading}
                          type="button"
                        >
                          {computed[e.key]?.alipayPayNotifyUrl ?? '—'}
                        </button>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="space-y-2">
                    <Label className="sr-only">证书目录</Label>
                    <Input
                      value={e.certsDir ?? ''}
                      onChange={(ev) =>
                        updateRow(idx, { certsDir: ev.target.value })
                      }
                      disabled={loading}
                      placeholder="/app/certs"
                    />
                    <div className="space-y-1 text-xs text-slate-500">
                      <div>Docker 部署建议把证书挂载到此目录（容器内路径）</div>
                      <div>
                        微信私钥：
                        <button
                          className="ml-1 underline"
                          onClick={() =>
                            copy(
                              computed[e.key]?.wechatPrivateKeyPathExample ??
                                null,
                            )
                          }
                          disabled={loading}
                          type="button"
                        >
                          {computed[e.key]?.wechatPrivateKeyPathExample ?? '—'}
                        </button>
                      </div>
                      <div>
                        支付宝私钥：
                        <button
                          className="ml-1 underline"
                          onClick={() =>
                            copy(
                              computed[e.key]?.alipayPrivateKeyPathExample ??
                                null,
                            )
                          }
                          disabled={loading}
                          type="button"
                        >
                          {computed[e.key]?.alipayPrivateKeyPathExample ?? '—'}
                        </button>
                      </div>
                      <div>
                        支付宝公钥：
                        <button
                          className="ml-1 underline"
                          onClick={() =>
                            copy(
                              computed[e.key]?.alipayPublicKeyPathExample ??
                                null,
                            )
                          }
                          disabled={loading}
                          type="button"
                        >
                          {computed[e.key]?.alipayPublicKeyPathExample ?? '—'}
                        </button>
                      </div>
                      <div className="text-slate-500">
                        将以上路径填写到「支付设置」里的 PrivateKeyPath/PublicKeyPath
                      </div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-medium text-slate-900">使用说明</div>
        <div className="mt-2 text-sm text-slate-600">
          支付平台回调要求可被公网访问。若当前仅本地开发（localhost），建议先在「支付设置」
          打开沙箱模式，扫码弹框用于联调 UI；真实回调需使用公网域名或内网穿透。
        </div>
      </Card>
    </div>
  );
}
