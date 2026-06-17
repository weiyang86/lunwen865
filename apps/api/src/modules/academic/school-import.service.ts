import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcademicRegionLevel,
  AcademicSchoolReviewStatus,
  AcademicSchoolSource,
  AcademicStatus,
  AcademicSyncLogLevel,
} from '@prisma/client';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

const LEGACY_HEADERS = [
  'provinceCode',
  'cityCode',
  'name',
  'code',
  'schoolType',
  'educationLevels',
  'status',
  'sortOrder',
  'remark',
];
const EXTENDED_HEADERS = [
  ...LEGACY_HEADERS.slice(0, -1),
  'source',
  'sourceVersion',
  'sourceUrl',
  'confidence',
  'remark',
];
const SCHOOL_TYPES = new Set(['UNDERGRADUATE', 'VOCATIONAL', 'ADULT', 'OTHER']);
const EDUCATION_LEVELS = new Set([
  'UNDERGRADUATE',
  'VOCATIONAL',
  'MASTER',
  'DOCTOR',
  'ADULT',
]);
const IMPORT_CACHE_TTL_MS = 30 * 60 * 1000;

type RawRow = Record<string, string>;
export type SchoolImportError = {
  rowNumber: number;
  field: string;
  message: string;
  rawValue?: string;
};
export type NormalizedSchoolImportRow = {
  rowNumber: number;
  provinceCode: string;
  cityCode: string;
  provinceName: string;
  cityName: string;
  name: string;
  code: string;
  schoolType: string;
  educationLevels: string[];
  status: AcademicStatus;
  sortOrder: number;
  source: AcademicSchoolSource;
  sourceVersion: string | null;
  sourceUrl: string | null;
  syncKey: string;
  confidence: number;
  remark: string | null;
  mode: 'create' | 'update';
};

type PreviewCache = {
  expiresAt: number;
  rows: NormalizedSchoolImportRow[];
  report: SchoolImportPreview;
};
export type SchoolImportPreview = {
  previewId: string;
  totalRows: number;
  validRows: number;
  createRows: number;
  updateRows: number;
  errorRows: number;
  duplicateRows: number;
  warnings: string[];
  sampleRows: NormalizedSchoolImportRow[];
  errors: SchoolImportError[];
};

const previewCache = new Map<string, PreviewCache>();

@Injectable()
export class SchoolImportService {
  constructor(private readonly prisma: PrismaService) {}

  template(version: 'legacy' | 'extended') {
    const headers = version === 'legacy' ? LEGACY_HEADERS : EXTENDED_HEADERS;
    const example =
      version === 'legacy'
        ? [
            '500000',
            '500100',
            '重庆大学',
            '10611',
            'UNDERGRADUATE',
            'UNDERGRADUATE,MASTER,DOCTOR',
            'ACTIVE',
            '0',
            '示例',
          ]
        : [
            '500000',
            '500100',
            '重庆大学',
            '10611',
            'UNDERGRADUATE',
            'UNDERGRADUATE,MASTER,DOCTOR',
            'ACTIVE',
            '0',
            'MOE',
            '2026',
            'https://example.edu.cn/moe-schools.xlsx',
            '100',
            '示例',
          ];
    return `${headers.join(',')}\n${example.map(csvEscape).join(',')}\n`;
  }

  async preview(
    file:
      | { originalname?: string; mimetype?: string; buffer?: Buffer }
      | undefined,
  ): Promise<SchoolImportPreview> {
    if (!file?.buffer?.length)
      throw new BadRequestException('请上传教育部高校名单 Excel 或 CSV 文件');
    const rawRows = await parseSchoolFile(file);
    const warnings: string[] = [];
    const errors: SchoolImportError[] = [];
    const rows: NormalizedSchoolImportRow[] = [];
    const seenInFile = new Set<string>();
    const duplicateCodes = new Set<string>();
    const regionCodes = Array.from(
      new Set(
        rawRows
          .flatMap((r) => [cell(r, 'provinceCode'), cell(r, 'cityCode')])
          .filter(Boolean),
      ),
    );
    const regions = await this.prisma.academicRegion.findMany({
      where: { code: { in: regionCodes } },
    });
    const regionMap = new Map(regions.map((r) => [r.code, r]));
    const existing = await this.prisma.academicSchool.findMany({
      where: {
        code: { in: rawRows.map((r) => cell(r, 'code')).filter(Boolean) },
      },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((x) => x.code).filter(Boolean));

    rawRows.forEach((raw, index) => {
      const rowNumber = index + 2;
      const rowErrors: SchoolImportError[] = [];
      const code = cell(raw, 'code');
      const name = cell(raw, 'name');
      const provinceCode = cell(raw, 'provinceCode');
      const cityCode = cell(raw, 'cityCode');
      if (!name)
        rowErrors.push({
          rowNumber,
          field: 'name',
          message: '学校名称必填',
          rawValue: name,
        });
      if (!code)
        rowErrors.push({
          rowNumber,
          field: 'code',
          message: '学校标识码 code 必填，推荐使用教育部学校标识码',
          rawValue: code,
        });
      if (code && seenInFile.has(code)) {
        duplicateCodes.add(code);
        rowErrors.push({
          rowNumber,
          field: 'code',
          message: '文件内 code 重复，确认导入前请去重',
          rawValue: code,
        });
      }
      if (code) seenInFile.add(code);
      const province = regionMap.get(provinceCode);
      if (!province || province.level !== AcademicRegionLevel.PROVINCE)
        rowErrors.push({
          rowNumber,
          field: 'provinceCode',
          message: 'provinceCode 不存在于地区库或不是省级节点',
          rawValue: provinceCode,
        });
      const city = regionMap.get(cityCode);
      if (!city || city.level !== AcademicRegionLevel.CITY)
        rowErrors.push({
          rowNumber,
          field: 'cityCode',
          message: 'cityCode 不存在于地区库或不是市级节点',
          rawValue: cityCode,
        });
      if (city && province && city.parentCode !== province.code)
        rowErrors.push({
          rowNumber,
          field: 'cityCode',
          message: 'cityCode 的 parentCode 与 provinceCode 不匹配',
          rawValue: cityCode,
        });

      const levelInfo = normalizeSchoolTypeAndLevels(raw);
      if (levelInfo.error)
        rowErrors.push({
          rowNumber,
          field: levelInfo.error.field,
          message: levelInfo.error.message,
          rawValue: levelInfo.error.rawValue,
        });
      const status = normalizeStatus(cell(raw, 'status'));
      if (!status)
        rowErrors.push({
          rowNumber,
          field: 'status',
          message: 'status 仅支持 ACTIVE / DISABLED / INACTIVE',
          rawValue: cell(raw, 'status'),
        });
      const source = normalizeSource(cell(raw, 'source'));
      if (!source)
        rowErrors.push({
          rowNumber,
          field: 'source',
          message: 'source 仅支持 MOE / CHSI / MANUAL',
          rawValue: cell(raw, 'source'),
        });
      const confidence = normalizeConfidence(
        cell(raw, 'confidence'),
        source ?? AcademicSchoolSource.MANUAL,
      );
      if (confidence === null)
        rowErrors.push({
          rowNumber,
          field: 'confidence',
          message: 'confidence 必须是 0-100 的数字',
          rawValue: cell(raw, 'confidence'),
        });
      const sortOrder = toInt(cell(raw, 'sortOrder'), 0);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        return;
      }
      rows.push({
        rowNumber,
        provinceCode,
        cityCode,
        provinceName: province!.name,
        cityName: city!.name,
        name,
        code,
        schoolType: levelInfo.schoolType!,
        educationLevels: levelInfo.educationLevels,
        status: status!,
        sortOrder,
        source: source!,
        sourceVersion: optional(cell(raw, 'sourceVersion')),
        sourceUrl: optional(cell(raw, 'sourceUrl')),
        syncKey: `${source}:${code}`,
        confidence: confidence!,
        remark: optional(cell(raw, 'remark')),
        mode: existingCodes.has(code) ? 'update' : 'create',
      });
    });

    if (rawRows.length === 0) warnings.push('文件中没有可导入的数据行');
    const previewId = randomUUID();
    const report: SchoolImportPreview = {
      previewId,
      totalRows: rawRows.length,
      validRows: rows.length,
      createRows: rows.filter((r) => r.mode === 'create').length,
      updateRows: rows.filter((r) => r.mode === 'update').length,
      errorRows: new Set(errors.map((e) => e.rowNumber)).size,
      duplicateRows: duplicateCodes.size,
      warnings,
      sampleRows: rows.slice(0, 20),
      errors,
    };
    previewCache.set(previewId, {
      expiresAt: Date.now() + IMPORT_CACHE_TTL_MS,
      rows,
      report,
    });
    return report;
  }

  async confirm(previewId: string) {
    this.cleanupCache();
    const cached = previewCache.get(previewId);
    if (!cached)
      throw new NotFoundException('预览结果已过期或不存在，请重新上传预览');
    if (cached.report.errors.length > 0)
      throw new BadRequestException('预览结果存在错误行，请修正后重新上传');
    const now = new Date();
    let created = 0;
    let updated = 0;
    for (const row of cached.rows) {
      const { provinceId, cityId } = await this.ensureProvinceCity(row);
      await this.prisma.academicSchool.upsert({
        where: { code: row.code },
        create: {
          provinceId,
          cityId,
          provinceCode: row.provinceCode,
          cityCode: row.cityCode,
          name: row.name,
          code: row.code,
          schoolType: row.schoolType,
          educationLevels: row.educationLevels,
          status: row.status,
          sortOrder: row.sortOrder,
          source: row.source,
          sourceVersion: row.sourceVersion,
          sourceUrl: row.sourceUrl,
          syncKey: row.syncKey,
          confidence: row.confidence,
          lastSyncedAt: now,
          reviewStatus: AcademicSchoolReviewStatus.APPROVED,
          reviewedAt: now,
          remark: row.remark,
        },
        update: {
          provinceId,
          cityId,
          provinceCode: row.provinceCode,
          cityCode: row.cityCode,
          name: row.name,
          schoolType: row.schoolType,
          educationLevels: row.educationLevels,
          status: row.status,
          sortOrder: row.sortOrder,
          source: row.source,
          sourceVersion: row.sourceVersion,
          sourceUrl: row.sourceUrl,
          syncKey: row.syncKey,
          confidence: row.confidence,
          lastSyncedAt: now,
          reviewStatus: AcademicSchoolReviewStatus.APPROVED,
          reviewedAt: now,
          remark: row.remark,
        },
      });
      if (row.mode === 'create') created += 1;
      else updated += 1;
    }
    await this.prisma.academicSyncLog.create({
      data: {
        level: AcademicSyncLogLevel.INFO,
        message: `高校名单导入完成：新增 ${created}，更新 ${updated}`,
        detail: { previewId, total: cached.rows.length, created, updated },
      },
    });
    previewCache.delete(previewId);
    return {
      previewId,
      successRows: cached.rows.length,
      createRows: created,
      updateRows: updated,
      failedRows: 0,
    };
  }

  private async ensureProvinceCity(row: NormalizedSchoolImportRow) {
    const province = await this.prisma.academicProvince.upsert({
      where: { code: row.provinceCode },
      create: {
        code: row.provinceCode,
        name: row.provinceName,
        status: AcademicStatus.ACTIVE,
        sortOrder: row.sortOrder,
      },
      update: { name: row.provinceName, status: AcademicStatus.ACTIVE },
    });
    const city = await this.prisma.academicCity.upsert({
      where: {
        provinceId_code: { provinceId: province.id, code: row.cityCode },
      },
      create: {
        provinceId: province.id,
        code: row.cityCode,
        name: row.cityName,
        status: AcademicStatus.ACTIVE,
        sortOrder: row.sortOrder,
      },
      update: { name: row.cityName, status: AcademicStatus.ACTIVE },
    });
    return { provinceId: province.id, cityId: city.id };
  }

  private cleanupCache() {
    const now = Date.now();
    for (const [id, value] of previewCache)
      if (value.expiresAt < now) previewCache.delete(id);
  }
}

export async function parseSchoolFile(file: {
  originalname?: string;
  mimetype?: string;
  buffer?: Buffer;
}): Promise<RawRow[]> {
  const name = file.originalname?.toLowerCase() ?? '';
  if (name.endsWith('.csv') || file.mimetype?.includes('csv'))
    return parseCsv(file.buffer!.toString('utf8'));
  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    file.mimetype?.includes('spreadsheet')
  ) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer! as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const headers = (sheet.getRow(1).values as unknown[])
      .slice(1)
      .map((v) => excelCellToString(v).trim());
    const rows: RawRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: RawRow = {};
      headers.forEach((h, index) => {
        record[h] = excelCellToString(row.getCell(index + 1).value).trim();
      });
      if (Object.values(record).some(Boolean)) rows.push(record);
    });
    return rows;
  }
  throw new BadRequestException('仅支持 Excel .xlsx/.xls 或 CSV 文件');
}

function parseCsv(text: string): RawRow[] {
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  const headers = rows.shift()?.map((h) => h.trim()) ?? [];
  return rows
    .filter((r) => r.some((c) => c.trim()))
    .map((row) =>
      Object.fromEntries(headers.map((h, i) => [h, (row[i] ?? '').trim()])),
    );
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cellValue = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cellValue += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cellValue += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cellValue);
      cellValue = '';
    } else if (ch === '\n') {
      row.push(cellValue);
      rows.push(row);
      row = [];
      cellValue = '';
    } else if (ch !== '\r') cellValue += ch;
  }
  row.push(cellValue);
  if (row.length > 1 || row[0]) rows.push(row);
  return rows;
}

function excelCellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const record = value as {
      text?: unknown;
      result?: unknown;
      richText?: Array<{ text?: unknown }>;
    };
    if (typeof record.text === 'string') return record.text;
    if (record.result !== undefined) return excelCellToString(record.result);
    if (Array.isArray(record.richText))
      return record.richText.map((x) => excelCellToString(x.text)).join('');
  }
  return '';
}

function cell(row: RawRow, key: string) {
  return String(row[key] ?? '').trim();
}
function optional(v: string) {
  return v.trim() ? v.trim() : null;
}
function toInt(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function normalizeSource(v: string): AcademicSchoolSource | null {
  const value = (v || 'MANUAL').trim().toUpperCase();
  return Object.values(AcademicSchoolSource).includes(
    value as AcademicSchoolSource,
  )
    ? (value as AcademicSchoolSource)
    : null;
}
function normalizeStatus(v: string): AcademicStatus | null {
  const value = (v || 'ACTIVE').trim().toUpperCase();
  if (value === 'ACTIVE') return AcademicStatus.ACTIVE;
  if (value === 'DISABLED' || value === 'INACTIVE')
    return AcademicStatus.INACTIVE;
  return null;
}
function normalizeConfidence(
  v: string,
  source: AcademicSchoolSource,
): number | null {
  if (!v) return source === AcademicSchoolSource.MOE ? 100 : 80;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}
function normalizeSchoolTypeAndLevels(row: RawRow): {
  schoolType?: string;
  educationLevels: string[];
  error?: { field: string; message: string; rawValue?: string };
} {
  const rawLevel =
    cell(row, '办学层次') ||
    cell(row, 'level') ||
    cell(row, 'educationLevelText');
  if (rawLevel) {
    if (rawLevel.includes('本科'))
      return {
        schoolType: 'UNDERGRADUATE',
        educationLevels: ['UNDERGRADUATE'],
      };
    if (rawLevel.includes('专科') || rawLevel.includes('高职'))
      return { schoolType: 'VOCATIONAL', educationLevels: ['VOCATIONAL'] };
    if (rawLevel.includes('成人'))
      return { schoolType: 'ADULT', educationLevels: ['ADULT'] };
  }
  const schoolType = (cell(row, 'schoolType') || 'OTHER').toUpperCase();
  if (!SCHOOL_TYPES.has(schoolType))
    return {
      educationLevels: [],
      error: {
        field: 'schoolType',
        message: 'schoolType 仅支持 UNDERGRADUATE / VOCATIONAL / ADULT / OTHER',
        rawValue: schoolType,
      },
    };
  const educationLevels = (cell(row, 'educationLevels') || schoolType)
    .split(/[，,;；|]/)
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
  const invalid = educationLevels.find((x) => !EDUCATION_LEVELS.has(x));
  if (invalid)
    return {
      educationLevels,
      error: {
        field: 'educationLevels',
        message: 'educationLevels 包含非法枚举值',
        rawValue: invalid,
      },
    };
  return { schoolType, educationLevels };
}
function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
