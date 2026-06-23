'use client';
import { useState } from 'react';
import { Download, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { academicApi } from '@/services/admin/academic';
import type { SchoolImportPreview } from '@/types/admin/academic';

export function CollegeDataPanel({ onImported }: { onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SchoolImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  async function previewFile() { if (!file) return toast.error('请先选择学院模板文件'); setLoading(true); try { const data = await academicApi.previewCollegeImport(file); setPreview(data); toast.success(`预览完成：${data.validRows}/${data.totalRows} 行有效`); } catch (e) { toast.error(e instanceof Error ? e.message : '学院导入预览失败'); } finally { setLoading(false); } }
  async function confirm() { if (!preview) return; if (preview.errors.length) return toast.error('存在错误行，请下载错误报告修正后重新上传'); setLoading(true); try { const data = await academicApi.confirmCollegeImport(preview.previewId); toast.success(`导入完成：新增 ${data.createRows}，更新 ${data.updateRows}`); setFile(null); setPreview(null); onImported(); } catch (e) { toast.error(e instanceof Error ? e.message : '学院确认导入失败'); } finally { setLoading(false); } }
  return <div className="rounded-xl border bg-card p-4"><div className="flex flex-wrap items-center gap-2"><a href={academicApi.collegeImportTemplateUrl()}><Button variant="outline" type="button"><Download className="mr-2 size-4" />下载学院模板</Button></a><input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><Button onClick={previewFile} disabled={!file || loading}><UploadCloud className="mr-2 size-4" />导入预览</Button><Button onClick={confirm} disabled={!preview || loading || Boolean(preview?.errors.length)}>确认导入</Button><Button variant="secondary" onClick={() => toast.info('请通过 API 配置采集源并运行采集；待审核数据入口已由 /api/admin/academic-data/colleges/staging 提供。')}>西南片区/待审核</Button></div>{preview ? <p className="mt-3 text-sm text-muted-foreground">总行数 {preview.totalRows}，新增 {preview.createRows}，更新 {preview.updateRows}，错误 {preview.errorRows}，重复 {preview.duplicateRows}</p> : null}{preview?.errors.length ? <div className="mt-2 max-h-32 overflow-auto text-xs text-red-600">{preview.errors.slice(0, 20).map((e) => <div key={`${e.rowNumber}-${e.field}`}>第 {e.rowNumber} 行 {e.field}: {e.message}</div>)}</div> : null}</div>;
}
