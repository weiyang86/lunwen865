import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcademicSchoolMajorReviewStatus,
  AcademicSchoolMajorSource,
  AcademicStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { parseSchoolFile } from './school-import.service';

const HEADERS = [
  'schoolCode',
  'schoolName',
  'collegeName',
  'majorCode',
  'majorName',
  'educationLevel',
  'status',
  'source',
  'sourceUrl',
  'confidence',
  'remark',
];
const LEVELS = new Set(['UNDERGRADUATE', 'VOCATIONAL', 'MASTER', 'DOCTOR']);
const TTL = 30 * 60 * 1000;
const EXCLUDE = [
  '通知公告',
  '新闻动态',
  '党建工作',
  '学生工作',
  '招生就业',
  '科学研究',
  '人才培养',
  '下载中心',
  '首页',
  '更多',
  '简章',
  '计划',
];

type RawRow = Record<string, string>;
type Err = {
  rowNumber: number;
  field: string;
  message: string;
  rawValue?: string;
};
type Row = {
  rowNumber: number;
  schoolId: string;
  schoolCode: string;
  schoolName: string;
  collegeId: string | null;
  collegeName: string | null;
  majorId: string | null;
  majorCode: string;
  majorName: string;
  educationLevel: string;
  status: AcademicStatus;
  source: AcademicSchoolMajorSource;
  sourceUrl: string | null;
  confidence: number;
  remark: string | null;
  warnings: string[];
  mode: 'create' | 'update';
};
type Preview = {
  previewId: string;
  totalRows: number;
  validRows: number;
  createRows: number;
  updateRows: number;
  errorRows: number;
  duplicateRows: number;
  warnings: string[];
  sampleRows: Row[];
  errors: Err[];
};
const cache = new Map<
  string,
  { expiresAt: number; rows: Row[]; report: Preview }
>();

@Injectable()
export class SchoolMajorDataService {
  constructor(private readonly prisma: PrismaService) {}

  template() {
    const example = [
      '4150010637',
      '重庆师范大学',
      '计算机与信息科学学院',
      '080901',
      '计算机科学与技术',
      'UNDERGRADUATE',
      'ACTIVE',
      'MANUAL',
      '',
      '90',
      '示例',
    ];
    return `${HEADERS.join(',')}\n${example.map(csvEscape).join(',')}\n`;
  }

  async list(query: Record<string, string>) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20), 1), 100);
    const schoolCodes = await this.schoolCodesByArea(query);
    const where: Record<string, unknown> = {};
    if (query.schoolCode) where.schoolCode = query.schoolCode;
    else if (schoolCodes) where.schoolCode = { in: schoolCodes };
    if (query.collegeId) where.collegeId = query.collegeId;
    if (query.majorCode) where.majorCode = query.majorCode;
    if (query.educationLevel) where.educationLevel = query.educationLevel;
    if (query.status) where.status = normalizeStatus(query.status) ?? undefined;
    if (query.keyword)
      where.OR = [
        { majorName: { contains: query.keyword, mode: 'insensitive' } },
        { majorCode: { contains: query.keyword, mode: 'insensitive' } },
        { collegeName: { contains: query.keyword, mode: 'insensitive' } },
        { schoolCode: { contains: query.keyword, mode: 'insensitive' } },
      ];
    const [items, total] = await Promise.all([
      this.prisma.academicSchoolMajor.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.academicSchoolMajor.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async preview(
    file:
      | { originalname?: string; mimetype?: string; buffer?: Buffer }
      | undefined,
  ): Promise<Preview> {
    if (!file?.buffer?.length)
      throw new BadRequestException(
        '请上传学校-学院-专业关系 Excel 或 CSV 文件',
      );
    const rawRows = await parseSchoolFile(file);
    const errors: Err[] = [];
    const warnings: string[] = [];
    const rows: Row[] = [];
    const schoolCodes = uniq(
      rawRows.map((r) => cell(r, 'schoolCode')).filter(Boolean),
    );
    const schools = await this.prisma.academicSchool.findMany({
      where: { code: { in: schoolCodes } },
      select: { id: true, code: true, name: true },
    });
    const schoolMap = new Map(schools.map((s) => [s.code!, s]));
    const majorCodes = uniq(
      rawRows.map((r) => cell(r, 'majorCode')).filter(Boolean),
    );
    const majorNames = uniq(
      rawRows.map((r) => cell(r, 'majorName')).filter(Boolean),
    );
    const majors = await this.prisma.academicCatalogMajor.findMany({
      where: {
        OR: [{ code: { in: majorCodes } }, { name: { in: majorNames } }],
      },
      select: { id: true, code: true, name: true, educationLevel: true },
    });
    const majorByCode = new Map(majors.map((m) => [m.code, m]));
    const majorByName = new Map(majors.map((m) => [m.name, m]));
    const colleges = await this.prisma.academicCollege.findMany({
      where: { schoolCode: { in: schoolCodes } },
      select: { id: true, schoolCode: true, name: true },
    });
    const collegeByKey = new Map(
      colleges.map((c) => [`${c.schoolCode}:${c.name}`, c]),
    );
    const existing = await this.prisma.academicSchoolMajor.findMany({
      where: { schoolCode: { in: schoolCodes } },
      select: { schoolCode: true, majorCode: true, educationLevel: true },
    });
    const existingKeys = new Set(
      existing.map((r) => key(r.schoolCode, r.majorCode, r.educationLevel)),
    );
    const seen = new Set<string>();
    let duplicateRows = 0;
    rawRows.forEach((raw, index) => {
      const rowNumber = index + 2;
      const schoolCode = cell(raw, 'schoolCode');
      const majorCodeRaw = cell(raw, 'majorCode');
      const majorNameRaw = cell(raw, 'majorName');
      const educationLevel = cell(raw, 'educationLevel').toUpperCase();
      const rowErrors: Err[] = [];
      const rowWarnings: string[] = [];
      const school = schoolMap.get(schoolCode);
      if (!schoolCode)
        rowErrors.push({
          rowNumber,
          field: 'schoolCode',
          message: 'schoolCode 必填',
        });
      else if (!school)
        rowErrors.push({
          rowNumber,
          field: 'schoolCode',
          message: 'schoolCode 未匹配高校库',
          rawValue: schoolCode,
        });
      if (!majorCodeRaw && !majorNameRaw)
        rowErrors.push({
          rowNumber,
          field: 'majorCode',
          message: 'majorCode 或 majorName 至少填写一个',
        });
      if (!LEVELS.has(educationLevel))
        rowErrors.push({
          rowNumber,
          field: 'educationLevel',
          message:
            'educationLevel 仅支持 UNDERGRADUATE / VOCATIONAL / MASTER / DOCTOR',
          rawValue: educationLevel,
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
          message: 'source 仅支持 ADMISSION_SITE / SCHOOL_SITE / MANUAL',
          rawValue: cell(raw, 'source'),
        });
      const confidence = normalizeConfidence(
        cell(raw, 'confidence'),
        source ?? AcademicSchoolMajorSource.MANUAL,
      );
      if (confidence === null)
        rowErrors.push({
          rowNumber,
          field: 'confidence',
          message: 'confidence 必须为 0-100',
          rawValue: cell(raw, 'confidence'),
        });
      let major = majorCodeRaw ? majorByCode.get(majorCodeRaw) : undefined;
      if (!major && majorNameRaw) major = majorByName.get(majorNameRaw);
      if (!major && majorCodeRaw)
        rowWarnings.push(
          'majorCode 未匹配专业目录，将以导入文本入库并等待后续治理',
        );
      if (!major && majorNameRaw)
        rowWarnings.push(
          'majorName 未匹配专业目录，将以导入文本入库并等待后续治理',
        );
      const collegeName = cell(raw, 'collegeName') || null;
      const college =
        schoolCode && collegeName
          ? collegeByKey.get(`${schoolCode}:${collegeName}`)
          : undefined;
      if (collegeName && !college)
        rowWarnings.push('collegeName 未匹配学院库，将保留文本并建议人工复核');
      const finalMajorCode = major?.code ?? majorCodeRaw;
      const finalMajorName = major?.name ?? majorNameRaw;
      const importKey = key(schoolCode, finalMajorCode, educationLevel);
      if (seen.has(importKey)) {
        duplicateRows += 1;
        rowErrors.push({
          rowNumber,
          field: 'majorCode',
          message: '文件中存在重复 schoolCode + majorCode + educationLevel',
          rawValue: importKey,
        });
      }
      seen.add(importKey);
      if (rowErrors.length) {
        errors.push(...rowErrors);
        return;
      }
      if (rowWarnings.length)
        warnings.push(`第 ${rowNumber} 行：${rowWarnings.join('；')}`);
      rows.push({
        rowNumber,
        schoolId: school!.id,
        schoolCode,
        schoolName: cell(raw, 'schoolName') || school!.name,
        collegeId: college?.id ?? null,
        collegeName,
        majorId: major?.id ?? null,
        majorCode: finalMajorCode,
        majorName: finalMajorName,
        educationLevel,
        status: status!,
        source: source!,
        sourceUrl: optional(cell(raw, 'sourceUrl')),
        confidence: confidence!,
        remark: optional(cell(raw, 'remark')),
        warnings: rowWarnings,
        mode: existingKeys.has(importKey) ? 'update' : 'create',
      });
    });
    const previewId = randomUUID();
    const report = {
      previewId,
      totalRows: rawRows.length,
      validRows: rows.length,
      createRows: rows.filter((r) => r.mode === 'create').length,
      updateRows: rows.filter((r) => r.mode === 'update').length,
      errorRows: errors.length ? rawRows.length - rows.length : 0,
      duplicateRows,
      warnings,
      sampleRows: rows.slice(0, 20),
      errors,
    };
    cache.set(previewId, { expiresAt: Date.now() + TTL, rows, report });
    return report;
  }

  async confirm(previewId: string) {
    const cached = cache.get(previewId);
    if (!cached || cached.expiresAt < Date.now())
      throw new NotFoundException('导入预览已过期，请重新上传并预览');
    let created = 0;
    let updated = 0;
    for (const row of cached.rows) {
      const data = {
        schoolId: row.schoolId,
        schoolCode: row.schoolCode,
        collegeId: row.collegeId,
        collegeName: row.collegeName,
        majorId: row.majorId,
        majorCode: row.majorCode,
        majorName: row.majorName,
        educationLevel: row.educationLevel,
        status: row.status,
        source: row.source,
        sourceUrl: row.sourceUrl,
        syncKey: key(row.schoolCode, row.majorCode, row.educationLevel),
        confidence: row.confidence,
        lastSyncedAt: new Date(),
        reviewStatus: AcademicSchoolMajorReviewStatus.APPROVED,
        reviewedAt: new Date(),
        remark: row.remark,
      };
      await this.prisma.academicSchoolMajor.upsert({
        where: {
          schoolCode_majorCode_educationLevel: {
            schoolCode: row.schoolCode,
            majorCode: row.majorCode,
            educationLevel: row.educationLevel,
          },
        },
        create: data,
        update: data,
      });
      if (row.mode === 'create') created++;
      else updated++;
    }
    cache.delete(previewId);
    return {
      successRows: cached.rows.length,
      createRows: created,
      updateRows: updated,
      failedRows: 0,
    };
  }

  async runCrawl(dto: Record<string, unknown>) {
    const schoolCode =
      typeof dto.schoolCode === 'string' ? dto.schoolCode.trim() : '';
    const url = typeof dto.url === 'string' ? dto.url.trim() : '';
    const educationLevel = (
      typeof dto.educationLevel === 'string'
        ? dto.educationLevel
        : 'UNDERGRADUATE'
    )
      .trim()
      .toUpperCase();
    if (!schoolCode || !url)
      throw new BadRequestException('schoolCode 和 url 必填');
    if (!LEVELS.has(educationLevel))
      throw new BadRequestException(
        'educationLevel 仅支持 UNDERGRADUATE / VOCATIONAL / MASTER / DOCTOR',
      );
    const school = await this.prisma.academicSchool.findUnique({
      where: { code: schoolCode },
    });
    if (!school) throw new BadRequestException('schoolCode 未匹配高校库');
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'lunwen-academic-data-crawler/1.0' },
    });
    if (!response.ok)
      throw new BadRequestException(`采集页面请求失败：${response.status}`);
    const html = await response.text();
    const majors = await this.prisma.academicCatalogMajor.findMany({
      where: { educationLevel },
      select: { id: true, code: true, name: true },
    });
    const colleges = await this.prisma.academicCollege.findMany({
      where: { schoolCode },
      select: { id: true, name: true },
    });
    const htmlText = stripHtml(html);
    const matchedCollege = colleges.find((c) => htmlText.includes(c.name));
    const matched = majors
      .filter((m) => htmlText.includes(m.name))
      .slice(0, 100);
    const fallback = matched.length
      ? []
      : extractMajorCandidates(html)
          .slice(0, 30)
          .map((name) => ({ id: null, code: '', name }));
    const rows = [
      ...matched.map((m) => ({
        ...m,
        confidence: htmlText.includes(m.code) ? 92 : 80,
      })),
      ...fallback.map((m) => ({ ...m, confidence: 60 })),
    ];
    for (const m of rows)
      await this.prisma.academicSchoolMajorStaging.create({
        data: {
          schoolId: school.id,
          schoolCode,
          schoolName: school.name,
          collegeId: matchedCollege?.id ?? null,
          collegeName: matchedCollege?.name ?? null,
          majorId: m.id,
          majorCode: m.code || null,
          majorName: m.name,
          educationLevel,
          source: AcademicSchoolMajorSource.SCHOOL_SITE,
          sourceUrl: url,
          confidence: m.confidence,
          rawData: { url, extractedAt: new Date().toISOString() },
        },
      });
    return { created: rows.length, sampleRows: rows.slice(0, 20) };
  }

  async staging(query: Record<string, string>) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20), 1), 100);
    const schoolCodes = await this.schoolCodesByArea(query);
    const where: Record<string, unknown> = {};
    if (query.schoolCode) where.schoolCode = query.schoolCode;
    else if (schoolCodes) where.schoolCode = { in: schoolCodes };
    if (query.reviewStatus) where.reviewStatus = query.reviewStatus;
    if (query.educationLevel) where.educationLevel = query.educationLevel;
    const [items, total] = await Promise.all([
      this.prisma.academicSchoolMajorStaging.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.academicSchoolMajorStaging.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async approve(id: string) {
    const item = await this.prisma.academicSchoolMajorStaging.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException('待审核关系不存在');
    if (!item.schoolId || !item.schoolCode || !item.majorCode)
      throw new BadRequestException(
        '待审核数据缺少 schoolCode 或 majorCode，无法入正式表',
      );
    await this.prisma.academicSchoolMajor.upsert({
      where: {
        schoolCode_majorCode_educationLevel: {
          schoolCode: item.schoolCode,
          majorCode: item.majorCode,
          educationLevel: item.educationLevel,
        },
      },
      create: {
        schoolId: item.schoolId,
        schoolCode: item.schoolCode,
        collegeId: item.collegeId,
        collegeName: item.collegeName,
        majorId: item.majorId,
        majorCode: item.majorCode,
        majorName: item.majorName,
        educationLevel: item.educationLevel,
        status: AcademicStatus.ACTIVE,
        source: item.source,
        sourceUrl: item.sourceUrl,
        syncKey: key(item.schoolCode, item.majorCode, item.educationLevel),
        confidence: item.confidence,
        lastSyncedAt: new Date(),
        reviewStatus: AcademicSchoolMajorReviewStatus.APPROVED,
        reviewedAt: new Date(),
      },
      update: {
        collegeId: item.collegeId,
        collegeName: item.collegeName,
        majorId: item.majorId,
        majorName: item.majorName,
        source: item.source,
        sourceUrl: item.sourceUrl,
        confidence: item.confidence,
        lastSyncedAt: new Date(),
        reviewStatus: AcademicSchoolMajorReviewStatus.APPROVED,
        reviewedAt: new Date(),
      },
    });
    return this.prisma.academicSchoolMajorStaging.update({
      where: { id },
      data: {
        reviewStatus: AcademicSchoolMajorReviewStatus.APPROVED,
        reviewedAt: new Date(),
      },
    });
  }
  async reject(id: string, reason?: string) {
    return this.prisma.academicSchoolMajorStaging.update({
      where: { id },
      data: {
        reviewStatus: AcademicSchoolMajorReviewStatus.REJECTED,
        reviewedAt: new Date(),
        errorMessage: reason ?? null,
      },
    });
  }
  async batchApprove(ids: string[]) {
    let successRows = 0;
    for (const id of ids) {
      await this.approve(id);
      successRows += 1;
    }
    return { successRows };
  }

  async getSchoolMajorContext(params: {
    schoolCode: string;
    collegeName?: string;
    majorName?: string;
    educationLevel?: string;
  }) {
    const school = await this.prisma.academicSchool.findUnique({
      where: { code: params.schoolCode },
    });
    const where: Record<string, unknown> = {
      schoolCode: params.schoolCode,
      status: AcademicStatus.ACTIVE,
    };
    if (params.collegeName)
      where.collegeName = { contains: params.collegeName, mode: 'insensitive' };
    if (params.majorName)
      where.majorName = { contains: params.majorName, mode: 'insensitive' };
    if (params.educationLevel) where.educationLevel = params.educationLevel;
    const matchedRelations = await this.prisma.academicSchoolMajor.findMany({
      where,
      orderBy: [{ confidence: 'desc' }],
      take: 20,
    });
    return {
      school,
      college: matchedRelations[0]?.collegeName ?? null,
      major: matchedRelations[0]?.majorName ?? null,
      matchedRelations,
      source: matchedRelations[0]?.source ?? null,
      confidence: matchedRelations[0]?.confidence ?? null,
    };
  }

  private async schoolCodesByArea(query: Record<string, string>) {
    if (!query.provinceCode && !query.cityCode) return null;
    const schools = await this.prisma.academicSchool.findMany({
      where: {
        provinceCode: query.provinceCode || undefined,
        cityCode: query.cityCode || undefined,
      },
      select: { code: true },
    });
    return schools.map((s) => s.code).filter(Boolean) as string[];
  }
}

export function extractMajorCandidates(html: string) {
  const text = stripHtml(html);
  const candidates = new Set<string>();
  for (const m of text.matchAll(
    /[\u4e00-\u9fa5A-Za-z0-9（）()·]{2,30}(?:专业|工程|科学|技术|管理|教育|医学|学|设计)/g,
  )) {
    const name = m[0]
      .replace(/^(专业介绍|招生专业|开设专业|本科专业)/, '')
      .trim();
    if (name.length >= 2 && !EXCLUDE.some((x) => name.includes(x)))
      candidates.add(name);
  }
  return Array.from(candidates).slice(0, 100);
}
function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&amp;/g, ' ')
    .replace(/\s+/g, ' ');
}
function cell(row: RawRow, keyName: string) {
  return String(row[keyName] ?? '').trim();
}
function optional(v: string) {
  return v.trim() ? v.trim() : null;
}
function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}
function key(a: string, b: string, c: string) {
  return `${a}:${b}:${c}`;
}
function normalizeStatus(v: string): AcademicStatus | null {
  const x = (v || 'ACTIVE').trim().toUpperCase();
  if (x === 'ACTIVE') return AcademicStatus.ACTIVE;
  if (x === 'DISABLED' || x === 'INACTIVE') return AcademicStatus.INACTIVE;
  return null;
}
function normalizeSource(v: string): AcademicSchoolMajorSource | null {
  const x = (v || 'MANUAL').trim().toUpperCase();
  return Object.values(AcademicSchoolMajorSource).includes(
    x as AcademicSchoolMajorSource,
  )
    ? (x as AcademicSchoolMajorSource)
    : null;
}
function normalizeConfidence(v: string, source: AcademicSchoolMajorSource) {
  if (!v) return source === AcademicSchoolMajorSource.MANUAL ? 90 : 80;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}
function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
