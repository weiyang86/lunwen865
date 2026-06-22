'use client';

import { useMemo, useState } from 'react';
import { Download, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { academicApi } from '@/services/admin/academic';
import type { SchoolImportPreview } from '@/types/admin/academic';

type Kind = 'major' | 'discipline';

export function CatalogImportDialog({ kind, onImported }: { kind: Kind; onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SchoolImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const title = kind === 'major' ? '专业目录导入' : '学科目录导入';
  const errorCsv = useMemo(() => preview ? [['rowNumber','field','rawValue','message'], ...preview.errors.map((e) => [String(e.rowNumber), e.field, e.rawValue ?? '', e.message])].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n') : '', [preview]);

  async function doPreview() {
    if (!file) { toast.error('请先选择 Excel 或 CSV 文件'); return; }
    setLoading(true);
    try {
      const data = kind === 'major' ? await academicApi.previewMajorCatalogImport(file) : await academicApi.previewDisciplineCatalogImport(file);
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
      const result = kind === 'major' ? await academicApi.confirmMajorCatalogImport(preview.previewId) : await academicApi.confirmDisciplineCatalogImport(preview.previewId);
      toast.success(`导入完成：新增 ${result.createRows}，更新 ${result.updateRows}`);
      setOpen(false); setFile(null); setPreview(null); onImported();
    } catch (e) { toast.error(e instanceof Error ? e.message : '确认导入失败'); }
    finally { setLoading(false); }
  }

  function downloadErrors() {
    const blob = new Blob([`\uFEFF${errorCsv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${kind}-import-errors.csv`; a.click(); URL.revokeObjectURL(url);
  }

  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}><UploadCloud className="mr-2 size-4" />导入{kind === 'major' ? '专业' : '学科'}</Button>;
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4"><Card className="mx-auto max-w-6xl"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-5"><div className="flex flex-wrap gap-2"><a href={kind === 'major' ? academicApi.majorCatalogTemplateUrl() : academicApi.disciplineCatalogTemplateUrl()}><Button variant="outline" type="button"><Download className="mr-2 size-4" />下载模板</Button></a><Button variant="ghost" onClick={() => setOpen(false)}>关闭</Button></div><div className="rounded-lg border p-4"><p className="font-medium">1. 上传文件</p><input className="mt-3" type="file" accept=".csv,.xlsx,.xls" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); }} /><div className="mt-3 flex gap-2"><Button onClick={doPreview} disabled={loading || !file}>预览</Button><Button variant="outline" onClick={() => { setFile(null); setPreview(null); }}>重新上传</Button></div></div>{preview ? <div className="space-y-4 rounded-lg border p-4"><p className="font-medium">2. 预校验结果</p><div className="grid gap-3 md:grid-cols-5"><Info label="总行数" value={preview.totalRows} /><Info label="新增" value={preview.createRows} /><Info label="更新" value={preview.updateRows} /><Info label="错误" value={preview.errorRows} /><Info label="重复" value={preview.duplicateRows} /></div>{preview.errors.length > 0 ? <Button variant="outline" onClick={downloadErrors}>下载错误报告</Button> : null}<Table><TableHeader><TableRow><TableHead>行号</TableHead><TableHead>字段</TableHead><TableHead>原始值</TableHead><TableHead>错误原因</TableHead></TableRow></TableHeader><TableBody>{preview.errors.slice(0,50).map((e,index) => <TableRow key={`${e.rowNumber}-${e.field}-${index}`}><TableCell>{e.rowNumber}</TableCell><TableCell>{e.field}</TableCell><TableCell>{e.rawValue ?? '-'}</TableCell><TableCell>{e.message}</TableCell></TableRow>)}{preview.errors.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-slate-500">无错误</TableCell></TableRow> : null}</TableBody></Table><Table><TableHeader><TableRow><TableHead>操作</TableHead><TableHead>code</TableHead><TableHead>名称</TableHead></TableRow></TableHeader><TableBody>{preview.sampleRows.map((row) => <TableRow key={`${row.rowNumber}-${row.code}`}><TableCell>{row.mode === 'create' ? '新增' : '更新'}</TableCell><TableCell>{row.code}</TableCell><TableCell>{row.name}</TableCell></TableRow>)}</TableBody></Table><div className="flex justify-end"><Button onClick={doConfirm} disabled={loading || preview.errors.length > 0}>3. 确认导入</Button></div></div> : null}</CardContent></Card></div>;
}
function Info({ label, value }: { label: string; value: number }) { return <div className="rounded border bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-semibold">{value}</p></div>; }
