'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { adminHttp } from '@/lib/admin/api-client';

type DeploymentRecord = {
  id: string;
  env: string;
  version: string;
  image?: string;
  commit?: string;
  notes?: string;
  operatorId: string;
  createdAt: string;
};

type DeploymentEnv = {
  key: string;
  name: string;
  webBaseUrl?: string;
  apiBaseUrl?: string;
  webhookBaseUrl?: string;
};

const ENV_LABEL: Record<string, string> = {
  dev: '开发环境',
  staging: '预发布',
  prod: '生产环境',
};

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function AdminDeploymentsPage() {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<DeploymentRecord[]>([]);
  const [envs, setEnvs] = useState<DeploymentEnv[]>([]);

  const [env, setEnv] = useState<string>('prod');
  const [version, setVersion] = useState('');
  const [image, setImage] = useState('');
  const [commit, setCommit] = useState('');
  const [notes, setNotes] = useState('');

  const envOptions = useMemo(() => {
    const fromApi = envs.map((e) => ({ key: e.key, name: e.name }));
    const fallback = [
      { key: 'dev', name: ENV_LABEL.dev },
      { key: 'staging', name: ENV_LABEL.staging },
      { key: 'prod', name: ENV_LABEL.prod },
    ];
    const list = fromApi.length ? fromApi : fallback;
    const seen = new Set<string>();
    return list.filter((x) => {
      if (!x.key || seen.has(x.key)) return false;
      seen.add(x.key);
      return true;
    });
  }, [envs]);

  async function loadAll() {
    setLoading(true);
    try {
      const [r, e] = await Promise.all([
        adminHttp.get<DeploymentRecord[]>('/admin/deployments'),
        adminHttp.get<{ envs: DeploymentEnv[] }>('/admin/deployments/envs'),
      ]);
      setRecords(r);
      setEnvs(e.envs ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function createRecord() {
    const v = version.trim();
    if (!v) {
      toast.error('请填写版本号');
      return;
    }
    setLoading(true);
    try {
      const res = await adminHttp.post<DeploymentRecord[]>('/admin/deployments', {
        env,
        version: v,
        image: image.trim() || undefined,
        commit: commit.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setRecords(res);
      setVersion('');
      setImage('');
      setCommit('');
      setNotes('');
      toast.success('已新增部署记录');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecord(id: string) {
    setLoading(true);
    try {
      const res = await adminHttp.delete<DeploymentRecord[]>(
        `/admin/deployments/${id}`,
      );
      setRecords(res);
      toast.success('已删除部署记录');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">部署中心</h1>
          <p className="text-sm text-slate-500">
            记录每次发布信息，方便回溯与排查
          </p>
        </div>
        <Button variant="outline" onClick={loadAll} disabled={loading}>
          刷新
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>环境</Label>
            <Select value={env} onValueChange={setEnv} disabled={loading}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择环境" />
              </SelectTrigger>
              <SelectContent>
                {envOptions.map((x) => (
                  <SelectItem key={x.key} value={x.key}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>版本号</Label>
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="例如 v1.2.3"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>镜像（可选）</Label>
            <Input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="例如 ghcr.io/org/app:tag"
              disabled={loading}
            />
          </div>

          <div className="flex items-end">
            <Button onClick={createRecord} disabled={loading} className="w-full">
              新增记录
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Commit（可选）</Label>
            <Input
              value={commit}
              onChange={(e) => setCommit(e.target.value)}
              placeholder="例如 1a2b3c4"
              disabled={loading}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>发布说明（可选）</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="例如：修复支付回调路由；新增短信/邮箱注册"
            disabled={loading}
          />
        </div>
      </Card>

      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>环境</TableHead>
              <TableHead>版本</TableHead>
              <TableHead>镜像</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead className="w-[40%]">说明</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                  暂无部署记录
                </TableCell>
              </TableRow>
            ) : (
              records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-slate-600">
                    {formatDateTime(r.createdAt)}
                  </TableCell>
                  <TableCell>{ENV_LABEL[r.env] ?? r.env}</TableCell>
                  <TableCell className="font-medium text-slate-900">
                    {r.version}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">
                    {r.image ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">
                    {r.commit ?? '—'}
                  </TableCell>
                  <TableCell className="text-slate-700">
                    {r.notes?.trim() ? r.notes : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteRecord(r.id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
