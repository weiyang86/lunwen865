/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcademicCatalogReviewStatus,
  AcademicCatalogSource,
  AcademicDisciplineCatalogLevel,
  AcademicDisciplineCatalogType,
  AcademicStatus,
  AcademicSyncLogLevel,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { parseSchoolFile } from './school-import.service';

const MAJOR_HEADERS = [
  'code',
  'name',
  'categoryCode',
  'categoryName',
  'disciplineCode',
  'disciplineName',
  'educationLevel',
  'degree',
  'years',
  'status',
  'version',
  'source',
  'sourceVersion',
  'sourceUrl',
  'confidence',
  'remark',
];
const DISCIPLINE_HEADERS = [
  'code',
  'name',
  'parentCode',
  'level',
  'type',
  'educationLevels',
  'status',
  'version',
  'source',
  'sourceVersion',
  'sourceUrl',
  'confidence',
  'remark',
];
const EDUCATION_LEVELS = new Set([
  'UNDERGRADUATE',
  'VOCATIONAL',
  'MASTER',
  'DOCTOR',
]);
const GRADUATE_LEVELS = new Set(['MASTER', 'DOCTOR']);
const TTL = 30 * 60 * 1000;

type RawRow = Record<string, string>;
type ImportError = {
  rowNumber: number;
  field: string;
  message: string;
  rawValue?: string;
};
type Preview<T> = {
  previewId: string;
  totalRows: number;
  validRows: number;
  createRows: number;
  updateRows: number;
  errorRows: number;
  duplicateRows: number;
  warnings: string[];
  sampleRows: T[];
  errors: ImportError[];
};
type MajorRow = {
  rowNumber: number;
  code: string;
  name: string;
  categoryCode: string | null;
  categoryName: string | null;
  disciplineCode: string | null;
  disciplineName: string | null;
  educationLevel: string;
  degree: string | null;
  years: string | null;
  status: AcademicStatus;
  version: string | null;
  source: AcademicCatalogSource;
  sourceVersion: string | null;
  sourceUrl: string | null;
  syncKey: string;
  confidence: number;
  remark: string | null;
  mode: 'create' | 'update';
};
type DisciplineRow = {
  rowNumber: number;
  code: string;
  name: string;
  parentCode: string | null;
  level: AcademicDisciplineCatalogLevel;
  type: AcademicDisciplineCatalogType;
  educationLevels: string[];
  status: AcademicStatus;
  version: string | null;
  source: AcademicCatalogSource;
  sourceVersion: string | null;
  sourceUrl: string | null;
  syncKey: string;
  confidence: number;
  remark: string | null;
  mode: 'create' | 'update';
};
const cache = new Map<
  string,
  {
    kind: 'major' | 'discipline';
    expiresAt: number;
    rows: Array<MajorRow | DisciplineRow>;
    report: any;
  }
>();

@Injectable()
export class CatalogImportService {
  constructor(private readonly prisma: PrismaService) {}

  majorTemplate() {
    return `${MAJOR_HEADERS.join(',')}\n${['080901', '计算机科学与技术', '0809', '计算机类', '08', '工学', 'UNDERGRADUATE', '工学', '4', 'ACTIVE', '2025', 'MOE', '2025', '', '100', ''].join(',')}\n`;
  }
  disciplineTemplate() {
    return `${DISCIPLINE_HEADERS.join(',')}\n${['08', '工学', '', 'DISCIPLINE_CATEGORY', 'ACADEMIC', 'MASTER,DOCTOR', 'ACTIVE', '2022', 'MOE', '2022', '', '100', ''].join(',')}\n${['0812', '计算机科学与技术', '08', 'FIRST_LEVEL_DISCIPLINE', 'ACADEMIC', 'MASTER,DOCTOR', 'ACTIVE', '2022', 'MOE', '2022', '', '100', ''].join(',')}\n${['0854', '电子信息', '08', 'PROFESSIONAL_DEGREE', 'PROFESSIONAL', 'MASTER,DOCTOR', 'ACTIVE', '2022', 'MOE', '2022', '', '100', ''].join(',')}\n`;
  }

  async previewMajors(
    file:
      | { originalname?: string; mimetype?: string; buffer?: Buffer }
      | undefined,
  ) {
    const rawRows = await this.parse(file);
    const existing = await this.prisma.academicCatalogMajor.findMany({
      where: {
        code: { in: rawRows.map((r) => cell(r, 'code')).filter(Boolean) },
      },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((x) => x.code));
    const { rows, errors, duplicates } = this.normalizeMajorRows(
      rawRows,
      existingCodes,
    );
    return this.cachePreview(
      'major',
      rows,
      errors,
      duplicates,
      rawRows.length,
    ) as Preview<MajorRow>;
  }

  async previewDisciplines(
    file:
      | { originalname?: string; mimetype?: string; buffer?: Buffer }
      | undefined,
  ) {
    const rawRows = await this.parse(file);
    const codes = rawRows.map((r) => cell(r, 'code')).filter(Boolean);
    const parentCodes = rawRows
      .map((r) => cell(r, 'parentCode'))
      .filter(Boolean);
    const [existing, parents] = await Promise.all([
      this.prisma.academicDisciplineCatalog.findMany({
        where: { code: { in: codes } },
        select: { code: true },
      }),
      this.prisma.academicDisciplineCatalog.findMany({
        where: { code: { in: parentCodes } },
        select: { code: true },
      }),
    ]);
    const existingCodes = new Set(existing.map((x) => x.code));
    const allowedParents = new Set([...codes, ...parents.map((x) => x.code)]);
    const { rows, errors, duplicates } = this.normalizeDisciplineRows(
      rawRows,
      existingCodes,
      allowedParents,
    );
    return this.cachePreview(
      'discipline',
      rows,
      errors,
      duplicates,
      rawRows.length,
    ) as Preview<DisciplineRow>;
  }

  async confirmMajors(previewId: string) {
    const entry = this.getCache(previewId, 'major');
    const now = new Date();
    let created = 0;
    let updated = 0;
    for (const row of entry.rows as MajorRow[]) {
      await this.prisma.academicCatalogMajor.upsert({
        where: { code: row.code },
        create: {
          ...row,
          rowNumber: undefined,
          mode: undefined,
          lastSyncedAt: now,
          reviewStatus: AcademicCatalogReviewStatus.APPROVED,
          reviewedAt: now,
        } as any,
        update: {
          name: row.name,
          categoryCode: row.categoryCode,
          categoryName: row.categoryName,
          disciplineCode: row.disciplineCode,
          disciplineName: row.disciplineName,
          educationLevel: row.educationLevel,
          degree: row.degree,
          years: row.years,
          status: row.status,
          version: row.version,
          source: row.source,
          sourceVersion: row.sourceVersion,
          sourceUrl: row.sourceUrl,
          syncKey: row.syncKey,
          confidence: row.confidence,
          remark: row.remark,
          lastSyncedAt: now,
          reviewStatus: AcademicCatalogReviewStatus.APPROVED,
          reviewedAt: now,
        },
      });
      if (row.mode === 'create') created++;
      else updated++;
    }
    await this.log(`专业目录导入完成：新增 ${created}，更新 ${updated}`, {
      previewId,
      created,
      updated,
    });
    cache.delete(previewId);
    return {
      previewId,
      successRows: entry.rows.length,
      createRows: created,
      updateRows: updated,
      failedRows: 0,
    };
  }

  async confirmDisciplines(previewId: string) {
    const entry = this.getCache(previewId, 'discipline');
    const now = new Date();
    let created = 0;
    let updated = 0;
    for (const row of entry.rows as DisciplineRow[]) {
      await this.prisma.academicDisciplineCatalog.upsert({
        where: { code: row.code },
        create: {
          ...row,
          rowNumber: undefined,
          mode: undefined,
          lastSyncedAt: now,
          reviewStatus: AcademicCatalogReviewStatus.APPROVED,
          reviewedAt: now,
        } as any,
        update: {
          name: row.name,
          parentCode: row.parentCode,
          level: row.level,
          type: row.type,
          educationLevels: row.educationLevels,
          status: row.status,
          version: row.version,
          source: row.source,
          sourceVersion: row.sourceVersion,
          sourceUrl: row.sourceUrl,
          syncKey: row.syncKey,
          confidence: row.confidence,
          remark: row.remark,
          lastSyncedAt: now,
          reviewStatus: AcademicCatalogReviewStatus.APPROVED,
          reviewedAt: now,
        },
      });
      if (row.mode === 'create') created++;
      else updated++;
    }
    await this.log(`学科目录导入完成：新增 ${created}，更新 ${updated}`, {
      previewId,
      created,
      updated,
    });
    cache.delete(previewId);
    return {
      previewId,
      successRows: entry.rows.length,
      createRows: created,
      updateRows: updated,
      failedRows: 0,
    };
  }

  async listMajors(q: any) {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 20)));
    const where: any = {};
    if (q.keyword)
      where.OR = [
        { code: { contains: q.keyword } },
        { name: { contains: q.keyword } },
      ];
    if (q.disciplineName) where.disciplineName = { contains: q.disciplineName };
    if (q.categoryName) where.categoryName = { contains: q.categoryName };
    if (q.educationLevel) where.educationLevel = q.educationLevel;
    if (q.status) where.status = normStatus(q.status);
    const [total, list] = await this.prisma.$transaction([
      this.prisma.academicCatalogMajor.count({ where }),
      this.prisma.academicCatalogMajor.findMany({
        where,
        orderBy: [{ code: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { list, total, page, pageSize };
  }
  async listDisciplines(q: any) {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 20)));
    const where: any = {};
    if (q.keyword)
      where.OR = [
        { code: { contains: q.keyword } },
        { name: { contains: q.keyword } },
      ];
    if (q.parentCode) where.parentCode = q.parentCode;
    if (q.level) where.level = q.level;
    if (q.type) where.type = q.type;
    if (q.educationLevel) where.educationLevels = { has: q.educationLevel };
    if (q.status) where.status = normStatus(q.status);
    const [total, list] = await this.prisma.$transaction([
      this.prisma.academicDisciplineCatalog.count({ where }),
      this.prisma.academicDisciplineCatalog.findMany({
        where,
        orderBy: [{ code: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { list, total, page, pageSize };
  }

  private async parse(
    file:
      | { originalname?: string; mimetype?: string; buffer?: Buffer }
      | undefined,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('请上传官方目录 Excel 或 CSV 文件');
    return parseSchoolFile(file);
  }
  private cachePreview(
    kind: 'major' | 'discipline',
    rows: Array<MajorRow | DisciplineRow>,
    errors: ImportError[],
    duplicateRows: number,
    totalRows: number,
  ) {
    const previewId = randomUUID();
    const report = {
      previewId,
      totalRows,
      validRows: rows.length,
      createRows: rows.filter((r) => r.mode === 'create').length,
      updateRows: rows.filter((r) => r.mode === 'update').length,
      errorRows: new Set(errors.map((e) => e.rowNumber)).size,
      duplicateRows,
      warnings: [],
      sampleRows: rows.slice(0, 20),
      errors,
    };
    cache.set(previewId, { kind, expiresAt: Date.now() + TTL, rows, report });
    return report as any;
  }
  private getCache(previewId: string, kind: 'major' | 'discipline') {
    const now = Date.now();
    for (const [id, v] of cache) if (v.expiresAt < now) cache.delete(id);
    const entry = cache.get(previewId);
    if (!entry || entry.kind !== kind)
      throw new NotFoundException('预览结果已过期或不存在，请重新上传预览');
    if (entry.report.errors.length > 0)
      throw new BadRequestException('预览结果存在错误行，请修正后重新上传');
    return entry;
  }
  private async log(message: string, detail: unknown) {
    await this.prisma.academicSyncLog.create({
      data: {
        level: AcademicSyncLogLevel.INFO,
        message,
        detail: detail as any,
      },
    });
  }

  private normalizeMajorRows(rawRows: RawRow[], existingCodes: Set<string>) {
    const seen = new Set<string>();
    const errors: ImportError[] = [];
    const rows: MajorRow[] = [];
    let duplicates = 0;
    rawRows.forEach((raw, index) => {
      const rowNumber = index + 2;
      const rowErrors: ImportError[] = [];
      const code = cell(raw, 'code');
      const name = cell(raw, 'name');
      if (!code)
        rowErrors.push({
          rowNumber,
          field: 'code',
          message: '专业代码必填',
          rawValue: code,
        });
      if (!name)
        rowErrors.push({
          rowNumber,
          field: 'name',
          message: '专业名称必填',
          rawValue: name,
        });
      if (code && seen.has(code)) {
        duplicates++;
        rowErrors.push({
          rowNumber,
          field: 'code',
          message: '文件内 code 重复',
          rawValue: code,
        });
      }
      if (code) seen.add(code);
      const educationLevel = cell(raw, 'educationLevel').toUpperCase();
      if (!EDUCATION_LEVELS.has(educationLevel))
        rowErrors.push({
          rowNumber,
          field: 'educationLevel',
          message:
            'educationLevel 仅支持 UNDERGRADUATE / VOCATIONAL / MASTER / DOCTOR',
          rawValue: educationLevel,
        });
      const status = normStatus(cell(raw, 'status'));
      if (!status)
        rowErrors.push({
          rowNumber,
          field: 'status',
          message: 'status 仅支持 ACTIVE / DISABLED / INACTIVE',
          rawValue: cell(raw, 'status'),
        });
      const source = normSource(cell(raw, 'source'), false);
      if (!source)
        rowErrors.push({
          rowNumber,
          field: 'source',
          message: 'source 仅支持 MOE / MANUAL',
          rawValue: cell(raw, 'source'),
        });
      const confidence = normConfidence(
        cell(raw, 'confidence'),
        source ?? AcademicCatalogSource.MOE,
      );
      if (confidence === null)
        rowErrors.push({
          rowNumber,
          field: 'confidence',
          message: 'confidence 必须是 0-100 的数字',
          rawValue: cell(raw, 'confidence'),
        });
      if (rowErrors.length) {
        errors.push(...rowErrors);
        return;
      }
      rows.push({
        rowNumber,
        code,
        name,
        categoryCode: opt(cell(raw, 'categoryCode')),
        categoryName: opt(cell(raw, 'categoryName')),
        disciplineCode: opt(cell(raw, 'disciplineCode')),
        disciplineName: opt(cell(raw, 'disciplineName')),
        educationLevel,
        degree: opt(cell(raw, 'degree')),
        years: opt(cell(raw, 'years')),
        status: status!,
        version: opt(cell(raw, 'version')),
        source: source!,
        sourceVersion: opt(cell(raw, 'sourceVersion')),
        sourceUrl: opt(cell(raw, 'sourceUrl')),
        syncKey: `${source}:${code}`,
        confidence: confidence!,
        remark: opt(cell(raw, 'remark')),
        mode: existingCodes.has(code) ? 'update' : 'create',
      });
    });
    return { rows, errors, duplicates };
  }
  private normalizeDisciplineRows(
    rawRows: RawRow[],
    existingCodes: Set<string>,
    allowedParents: Set<string>,
  ) {
    const seen = new Set<string>();
    const errors: ImportError[] = [];
    const rows: DisciplineRow[] = [];
    let duplicates = 0;
    rawRows.forEach((raw, index) => {
      const rowNumber = index + 2;
      const rowErrors: ImportError[] = [];
      const code = cell(raw, 'code');
      const name = cell(raw, 'name');
      const parentCode = opt(cell(raw, 'parentCode'));
      if (!code)
        rowErrors.push({
          rowNumber,
          field: 'code',
          message: '学科代码必填',
          rawValue: code,
        });
      if (!name)
        rowErrors.push({
          rowNumber,
          field: 'name',
          message: '学科名称必填',
          rawValue: name,
        });
      if (code && seen.has(code)) {
        duplicates++;
        rowErrors.push({
          rowNumber,
          field: 'code',
          message: '文件内 code 重复',
          rawValue: code,
        });
      }
      if (code) seen.add(code);
      if (parentCode && !allowedParents.has(parentCode))
        rowErrors.push({
          rowNumber,
          field: 'parentCode',
          message: 'parentCode 必须存在于本次导入或已有学科目录',
          rawValue: parentCode,
        });
      const level = cell(
        raw,
        'level',
      ).toUpperCase() as AcademicDisciplineCatalogLevel;
      if (!Object.values(AcademicDisciplineCatalogLevel).includes(level))
        rowErrors.push({
          rowNumber,
          field: 'level',
          message: 'level 枚举非法',
          rawValue: cell(raw, 'level'),
        });
      const type = cell(
        raw,
        'type',
      ).toUpperCase() as AcademicDisciplineCatalogType;
      if (!Object.values(AcademicDisciplineCatalogType).includes(type))
        rowErrors.push({
          rowNumber,
          field: 'type',
          message: 'type 仅支持 ACADEMIC / PROFESSIONAL',
          rawValue: cell(raw, 'type'),
        });
      const educationLevels = cell(raw, 'educationLevels')
        .split(/[，,;；|]/)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);
      const bad = educationLevels.find((x) => !GRADUATE_LEVELS.has(x));
      if (!educationLevels.length || bad)
        rowErrors.push({
          rowNumber,
          field: 'educationLevels',
          message: 'educationLevels 仅支持 MASTER / DOCTOR / MASTER,DOCTOR',
          rawValue: bad ?? cell(raw, 'educationLevels'),
        });
      const status = normStatus(cell(raw, 'status'));
      if (!status)
        rowErrors.push({
          rowNumber,
          field: 'status',
          message: 'status 仅支持 ACTIVE / DISABLED / INACTIVE',
          rawValue: cell(raw, 'status'),
        });
      const source = normSource(cell(raw, 'source'), true);
      if (!source)
        rowErrors.push({
          rowNumber,
          field: 'source',
          message: 'source 仅支持 MOE / DEGREE_COMMITTEE / MANUAL',
          rawValue: cell(raw, 'source'),
        });
      const confidence = normConfidence(
        cell(raw, 'confidence'),
        source ?? AcademicCatalogSource.MOE,
      );
      if (confidence === null)
        rowErrors.push({
          rowNumber,
          field: 'confidence',
          message: 'confidence 必须是 0-100 的数字',
          rawValue: cell(raw, 'confidence'),
        });
      if (rowErrors.length) {
        errors.push(...rowErrors);
        return;
      }
      rows.push({
        rowNumber,
        code,
        name,
        parentCode,
        level,
        type,
        educationLevels,
        status: status!,
        version: opt(cell(raw, 'version')),
        source: source!,
        sourceVersion: opt(cell(raw, 'sourceVersion')),
        sourceUrl: opt(cell(raw, 'sourceUrl')),
        syncKey: `${source}:${code}`,
        confidence: confidence!,
        remark: opt(cell(raw, 'remark')),
        mode: existingCodes.has(code) ? 'update' : 'create',
      });
    });
    return { rows, errors, duplicates };
  }
}
function cell(row: RawRow, key: string) {
  return String(row[key] ?? '').trim();
}
function opt(v: string) {
  return v ? v : null;
}
function normStatus(v: string) {
  const x = (v || 'ACTIVE').toUpperCase();
  if (x === 'ACTIVE') return AcademicStatus.ACTIVE;
  if (x === 'DISABLED' || x === 'INACTIVE') return AcademicStatus.INACTIVE;
  return null;
}
function normSource(v: string, discipline: boolean) {
  const x = (v || 'MOE').toUpperCase() as AcademicCatalogSource;
  if (
    x === AcademicCatalogSource.MOE ||
    x === AcademicCatalogSource.MANUAL ||
    (discipline && x === AcademicCatalogSource.DEGREE_COMMITTEE)
  )
    return x;
  return null;
}
function normConfidence(v: string, source: AcademicCatalogSource) {
  if (!v) return source === AcademicCatalogSource.MANUAL ? 80 : 100;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}
