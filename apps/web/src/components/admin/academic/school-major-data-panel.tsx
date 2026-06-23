'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Download, UploadCloud, Globe2, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { academicApi } from '@/services/admin/academic';
import type { SchoolImportPreview } from '@/types/admin/academic';

export function SchoolMajorDataPanel({ onImported }: { onImported?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SchoolImportPreview | null>(null);
  const [schoolCode, setSchoolCode] = useState('');
  const [url, setUrl] = useState('');
  const [educationLevel, setEducationLevel] = useState('UNDERGRADUATE');
  const [loading, setLoading] = useState(false);

  async function previewImport() {
    if (!file) return toast.error('请先选择 CSV / Excel 文件');
    setLoading(true);
    try {
      const data = await academicApi.previewSchoolMajorImport(file);
      setPreview(data);
      toast.success(`预校验完成：${data.validRows} 行可导入，${data.errorRows} 行错误`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '预校验失败');
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!preview?.previewId) return toast.error('请先完成预览');
    setLoading(true);
    try {
      const data = await academicApi.confirmSchoolMajorImport(preview.previewId);
      toast.success(`导入完成：新增 ${data.createRows}，更新 ${data.updateRows}`);
      setPreview(null);
      setFile(null);
      onImported?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '确认导入失败');
    } finally {
      setLoading(false);
    }
  }

  async function runCrawl() {
    if (!schoolCode.trim() || !url.trim()) return toast.error('请填写 schoolCode 和公开招生/学院 URL');
    setLoading(true);
    try {
      const data = await academicApi.runSchoolMajorCrawl({ schoolCode, url, educationLevel });
      toast.success(`采集完成：${data.created} 条候选进入待审核`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '采集失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>学校-学院-专业关系导入</CardTitle>
          <CardDescription>必须先预览再确认入库；确认后按 schoolCode + majorCode + educationLevel upsert。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><a href={academicApi.schoolMajorImportTemplateUrl()}><Download className="mr-2 size-4" />下载模板</a></Button>
          </div>
          <div className="space-y-2">
            <Label>上传 CSV / Excel</Label>
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void previewImport()} disabled={loading}><UploadCloud className="mr-2 size-4" />预览</Button>
            <Button onClick={() => void confirmImport()} disabled={loading || !preview || preview.errorRows > 0}><CheckCircle2 className="mr-2 size-4" />确认入库</Button>
          </div>
          {preview ? <PreviewTable preview={preview} /> : <p className="text-sm text-muted-foreground">empty：尚未上传文件；error：错误明细会在预览后展示。</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>低频定向采集</CardTitle>
          <CardDescription>只请求后台输入的公开 URL，结果进入 staging，人工审核后才入正式表。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2"><Label>schoolCode</Label><Input value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} placeholder="如 4150010637" /></div>
            <div className="space-y-2"><Label>educationLevel</Label><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}><option>UNDERGRADUATE</option><option>VOCATIONAL</option><option>MASTER</option><option>DOCTOR</option></select></div>
          </div>
          <div className="space-y-2"><Label>招生/学院公开页面 URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
          <Button onClick={() => void runCrawl()} disabled={loading}><Globe2 className="mr-2 size-4" />运行采集</Button>
          <p className="text-sm text-muted-foreground">待审核入口：调用 /api/admin/academic-data/school-majors/staging 查看，通过/驳回后再影响正式关系。</p>
        </CardContent>
      </Card>
    </div>
  );
}

function PreviewTable({ preview }: { preview: SchoolImportPreview }) {
  return <div className="space-y-3"><div className="grid gap-2 text-sm md:grid-cols-5"><span>总行数：{preview.totalRows}</span><span>可新增：{preview.createRows}</span><span>可更新：{preview.updateRows}</span><span>错误：{preview.errorRows}</span><span>重复：{preview.duplicateRows}</span></div>{preview.errors.length ? <Table><TableHeader><TableRow><TableHead>行号</TableHead><TableHead>字段</TableHead><TableHead>原始值</TableHead><TableHead>原因</TableHead></TableRow></TableHeader><TableBody>{preview.errors.slice(0,20).map((e, i) => <TableRow key={`${e.rowNumber}-${e.field}-${i}`}><TableCell>{e.rowNumber}</TableCell><TableCell>{e.field}</TableCell><TableCell>{e.rawValue}</TableCell><TableCell>{e.message}</TableCell></TableRow>)}</TableBody></Table> : null}<Table><TableHeader><TableRow><TableHead>学校</TableHead><TableHead>学院</TableHead><TableHead>专业</TableHead><TableHead>层次</TableHead><TableHead>模式</TableHead></TableRow></TableHeader><TableBody>{preview.sampleRows.slice(0,20).map((r) => <TableRow key={r.rowNumber}><TableCell>{r.schoolName ?? r.schoolCode}</TableCell><TableCell>{r.collegeName}</TableCell><TableCell>{r.majorName ?? r.majorCode}</TableCell><TableCell>{r.educationLevel}</TableCell><TableCell>{r.mode}</TableCell></TableRow>)}</TableBody></Table></div>;
}
