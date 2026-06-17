'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { academicApi } from '@/services/admin/academic';
import type { SchoolImportPreview } from '@/types/admin/academic';

export function SchoolImportDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SchoolImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const errorCsv = useMemo(() => {
    if (!preview) return '';
    const rows = [['rowNumber', 'field', 'rawValue', 'message'], ...preview.errors.map((e) => [String(e.rowNumber), e.field, e.rawValue ?? '', e.message])];
    return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  }, [preview]);

  async function doPreview() {
    if (!file) { toast.error('请先选择 Excel 或 CSV 文件'); return; }
    setLoading(true);
    try {
      const data = await academicApi.previewSchoolImport(file);
      setPreview(data);
      toast.success(`预校验完成：${data.validRows}/${data.totalRows} 行有效`);
    } catch (e) { toast.error(e instanceof Error ? e.message : '导入预览失败'); }
    finally { setLoading(false); }
  }

  async function doConfirm() {
    if (!preview) return;
    if (preview.errors.length > 0) { toast.error('存在错误行，请修正后重新上传'); return; }
    setLoading(true);
    try {
      const result = await academicApi.confirmSchoolImport(preview.previewId);
      toast.success(`导入完成：新增 ${result.createRows}，更新 ${result.updateRows}`);
      setOpen(false); setFile(null); setPreview(null); onImported();
    } catch (e) { toast.error(e instanceof Error ? e.message : '确认导入失败'); }
    finally { setLoading(false); }
  }

  function downloadErrors() {
    if (!errorCsv) return;
    const blob = new Blob([`\uFEFF${errorCsv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'academic-school-import-errors.csv'; a.click(); URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setPreview(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}><UploadCloud className="mr-2 size-4" />导入高校</Button>;
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="全国高校名单导入"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          setOpen(false);
          setPreview(null);
        }
      }}
    >
      <Card className="mx-auto max-w-6xl">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="size-5" />全国高校名单导入</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setOpen(false); setPreview(null); }}
            aria-label="关闭"
          >
            <X className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <a href={academicApi.schoolImportTemplateUrl('legacy')}><Button variant="outline" type="button"><Download className="mr-2 size-4" />下载旧模板</Button></a>
            <a href={academicApi.schoolImportTemplateUrl('extended')}><Button variant="outline" type="button"><Download className="mr-2 size-4" />下载新模板</Button></a>
            <Button variant="ghost" onClick={() => { setOpen(false); setPreview(null); }}>关闭</Button>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium">1. 上传文件</p>
            <input className="mt-3" type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
            <div className="mt-3 flex gap-2"><Button onClick={doPreview} disabled={loading || !file}>预校验</Button><Button variant="outline" onClick={() => { setFile(null); setPreview(null); }}>重新上传</Button></div>
          </div>
          {preview && <div className="space-y-4 rounded-lg border p-4"><p className="font-medium">2. 预校验结果</p><div className="grid gap-3 md:grid-cols-5"><Info label="总行数" value={preview.totalRows} /><Info label="可新增" value={preview.createRows} /><Info label="可更新" value={preview.updateRows} /><Info label="错误数" value={preview.errorRows} /><Info label="重复数" value={preview.duplicateRows} /></div>{preview.errors.length > 0 && <Button variant="outline" onClick={downloadErrors}>下载错误报告</Button>}<div><p className="mb-2 text-sm font-medium">错误明细</p><Table><TableHeader><TableRow><TableHead>行号</TableHead><TableHead>字段</TableHead><TableHead>原始值</TableHead><TableHead>错误原因</TableHead></TableRow></TableHeader><TableBody>{preview.errors.slice(0, 50).map((e, i) => <TableRow key={`${e.rowNumber}-${e.field}-${i}`}><TableCell>{e.rowNumber}</TableCell><TableCell>{e.field}</TableCell><TableCell>{e.rawValue ?? '-'}</TableCell><TableCell>{e.message}</TableCell></TableRow>)}{preview.errors.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-slate-500">无错误</TableCell></TableRow>}</TableBody></Table></div><div><p className="mb-2 text-sm font-medium">前 20 条预览数据</p><Table><TableHeader><TableRow><TableHead>操作</TableHead><TableHead>code</TableHead><TableHead>学校</TableHead><TableHead>地区</TableHead><TableHead>类型/层次</TableHead></TableRow></TableHeader><TableBody>{preview.sampleRows.map((r) => <TableRow key={`${r.rowNumber}-${r.code}`}><TableCell>{r.mode === 'create' ? '新增' : '更新'}</TableCell><TableCell>{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell>{r.provinceCode}/{r.cityCode}</TableCell><TableCell>{r.schoolType}/{r.educationLevels.join(',')}</TableCell></TableRow>)}</TableBody></Table></div><div className="flex justify-end"><Button onClick={doConfirm} disabled={loading || preview.errors.length > 0}>3. 确认导入</Button></div></div>}
        </CardContent>
      </Card>
    </div>
  );
}
function Info({ label, value }: { label: string; value: number }) { return <div className="rounded border bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-semibold">{value}</p></div>; }
