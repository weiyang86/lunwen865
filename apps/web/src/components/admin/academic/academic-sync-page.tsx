'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DatabaseZap, FileClock, RefreshCw, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { academicApi } from '@/services/admin/academic';
import type { AcademicSyncLog, RegionSyncPreview, RegionSyncStatus } from '@/types/admin/academic';

const NAV = [
  { href: '/admin/academic/schools', label: '高校管理' },
  { href: '/admin/academic/colleges', label: '学院管理' },
  { href: '/admin/academic/majors', label: '专业管理' },
  { href: '/admin/academic/disciplines', label: '学科目录' },
  { href: '/admin/academic/sync', label: '数据同步' },
];

export function AcademicSyncPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<RegionSyncStatus | null>(null);
  const [preview, setPreview] = useState<RegionSyncPreview | null>(null);
  const [logs, setLogs] = useState<AcademicSyncLog[]>([]);

  async function load() {
    const [syncStatus, logPage] = await Promise.all([academicApi.regionSyncStatus(), academicApi.syncLogs({ jobType: 'REGION_AMAP', pageSize: 10 })]);
    setStatus(syncStatus);
    setLogs(logPage.list);
  }

  useEffect(() => { void load().catch(() => toast.error('加载同步状态失败')); }, []);

  async function previewSync() {
    setLoading(true);
    try {
      const data = await academicApi.previewRegionSync();
      setPreview(data);
      toast.success(`预览完成：${data.total} 条地区数据`);
    } catch (e) { toast.error(e instanceof Error ? e.message : '预览失败'); }
    finally { setLoading(false); }
  }

  async function confirmSync() {
    if (!preview) { toast.error('请先预览同步结果'); return; }
    setLoading(true);
    try {
      const data = await academicApi.confirmRegionSync();
      toast.success(`入库完成：${data.total} 条地区数据`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : '确认入库失败'); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">后台 / 学术基础数据</p>
        <h1 className="text-2xl font-semibold text-slate-900">学术基础数据</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {NAV.map((item) => <Link key={item.href} href={item.href} className={`rounded-full px-3 py-2 text-sm ${item.href.endsWith('/sync') ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{item.label}</Link>)}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><DatabaseZap className="h-5 w-5" />地区数据同步</CardTitle>
          <CardDescription>数据源：高德行政区域 API；同步范围：全国；用于高校 provinceCode / cityCode 匹配。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Info label="API Key 配置" value={status?.apiKeyConfigured ? '已配置' : status?.mock ? '未配置（Mock）' : '未配置'} warn={!status?.apiKeyConfigured && !status?.mock} />
            <Info label="同步范围" value="全国" />
            <Info label="上次同步" value={status?.lastSuccessAt ? new Date(status.lastSuccessAt).toLocaleString() : '暂无'} />
            <Info label="任务状态" value={status?.status ?? 'IDLE'} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={previewSync} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />预览同步</Button>
            <Button variant="secondary" onClick={confirmSync} disabled={loading || !preview}><UploadCloud className="mr-2 h-4 w-4" />确认入库</Button>
            <Button variant="outline" onClick={() => void load()} disabled={loading}><FileClock className="mr-2 h-4 w-4" />查看日志</Button>
          </div>
          {!status?.apiKeyConfigured && !status?.mock && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">未配置 AMAP_WEB_SERVICE_KEY，真实同步会失败；本地测试可启用 ACADEMIC_REGION_SYNC_MOCK=true。</p>}
        </CardContent>
      </Card>
      {preview && <Card><CardHeader><CardTitle>预览结果</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-4"><Info label="总数" value={preview.total} /><Info label="新增" value={preview.createCount} /><Info label="更新" value={preview.updateCount} /><Info label="错误/异常" value={preview.warningCount} /></div><RegionTable rows={preview.samples} /></CardContent></Card>}
      <Card><CardHeader><CardTitle>同步日志</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>时间</TableHead><TableHead>级别</TableHead><TableHead>消息</TableHead></TableRow></TableHeader><TableBody>{logs.map((log) => <TableRow key={log.id}><TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell><TableCell>{log.level}</TableCell><TableCell>{log.message}</TableCell></TableRow>)}{logs.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-slate-500">暂无日志</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
    </div>
  );
}

function Info({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) { return <div className="rounded-lg border bg-white p-3"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 font-semibold ${warn ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p></div>; }
function RegionTable({ rows }: { rows: RegionSyncPreview['samples'] }) { return <Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>名称</TableHead><TableHead>层级</TableHead><TableHead>上级</TableHead></TableRow></TableHeader><TableBody>{rows.map((r) => <TableRow key={r.code}><TableCell>{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell>{r.level}</TableCell><TableCell>{r.parentCode ?? '-'}</TableCell></TableRow>)}</TableBody></Table>; }
