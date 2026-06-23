/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcademicCollegeReviewStatus,
  AcademicCollegeSource,
  AcademicStatus,
  AcademicSyncScope,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { parseSchoolFile } from './school-import.service';

export const SOUTHWEST_PROVINCE_CODES = [
  '500000',
  '510000',
  '520000',
  '530000',
  '540000',
] as const;
const HEADERS = [
  'schoolCode',
  'schoolName',
  'collegeName',
  'collegeCode',
  'status',
  'source',
  'sourceUrl',
  'confidence',
  'remark',
];
const TTL = 30 * 60 * 1000;
type RawRow = Record<string, string>;
type Err = {
  rowNumber: number;
  field: string;
  message: string;
  rawValue?: string;
};
type CollegeRow = {
  rowNumber: number;
  schoolId: string;
  schoolCode: string;
  schoolName: string;
  collegeName: string;
  collegeCode: string | null;
  status: AcademicStatus;
  source: AcademicCollegeSource;
  sourceUrl: string | null;
  confidence: number;
  remark: string | null;
  mode: 'create' | 'update';
};
const cache = new Map<
  string,
  { expiresAt: number; rows: CollegeRow[]; errors: Err[] }
>();

const INCLUDE = ['学院', '学部', '系', '研究院', '中心'];
const EXCLUDE = [
  '通知公告',
  '新闻动态',
  '党建工作',
  '学生工作',
  '招生就业',
  '科学研究',
  '人才培养',
  '下载中心',
  '更多',
  '首页',
  '学校概况',
];

@Injectable()
export class CollegeDataService {
  constructor(private readonly prisma: PrismaService) {}
  template() {
    return `${HEADERS.join(',')}\n${['4150010637', '重庆师范大学', '计算机与信息科学学院', '', 'ACTIVE', 'MANUAL', '', '90', ''].join(',')}\n`;
  }

  async list(q: any) {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 20)));
    const where: any = {};
    if (q.keyword) where.name = { contains: q.keyword };
    if (q.schoolCode) where.schoolCode = q.schoolCode;
    if (q.status) where.status = normStatus(q.status);
    if (q.provinceCode || q.cityCode) where.school = {};
    if (q.provinceCode) where.school.provinceCode = q.provinceCode;
    if (q.cityCode) where.school.cityCode = q.cityCode;
    const [total, list] = await this.prisma.$transaction([
      this.prisma.academicCollege.count({ where }),
      this.prisma.academicCollege.findMany({
        where,
        include: { school: true },
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { list, total, page, pageSize, southwest: SOUTHWEST_PROVINCE_CODES };
  }

  async preview(
    file:
      | { originalname?: string; mimetype?: string; buffer?: Buffer }
      | undefined,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('请上传学院导入 Excel 或 CSV 文件');
    const rawRows = await parseSchoolFile(file);
    const schoolCodes = [
      ...new Set(rawRows.map((r) => cell(r, 'schoolCode')).filter(Boolean)),
    ];
    const schools = await this.prisma.academicSchool.findMany({
      where: { code: { in: schoolCodes } },
      select: { id: true, code: true, name: true },
    });
    const schoolMap = new Map(schools.map((s) => [s.code!, s]));
    const existing = await this.prisma.academicCollege.findMany({
      where: { schoolCode: { in: schoolCodes } },
      select: { schoolCode: true, name: true },
    });
    const existingKeys = new Set(
      existing.map((x) => `${x.schoolCode}::${x.name}`),
    );
    const rows: CollegeRow[] = [];
    const errors: Err[] = [];
    const seen = new Set<string>();
    let duplicateRows = 0;
    rawRows.forEach((raw, index) => {
      const rowNumber = index + 2;
      const rowErrors: Err[] = [];
      const schoolCode = cell(raw, 'schoolCode');
      const collegeName = cell(raw, 'collegeName');
      if (!schoolCode)
        rowErrors.push({
          rowNumber,
          field: 'schoolCode',
          message: 'schoolCode 必填',
          rawValue: schoolCode,
        });
      const school = schoolMap.get(schoolCode);
      if (schoolCode && !school)
        rowErrors.push({
          rowNumber,
          field: 'schoolCode',
          message: 'schoolCode 无法匹配 academic_schools',
          rawValue: schoolCode,
        });
      if (!collegeName)
        rowErrors.push({
          rowNumber,
          field: 'collegeName',
          message: 'collegeName 必填',
          rawValue: collegeName,
        });
      const key = `${schoolCode}::${collegeName}`;
      if (schoolCode && collegeName && seen.has(key)) {
        duplicateRows++;
        rowErrors.push({
          rowNumber,
          field: 'collegeName',
          message: '文件内 schoolCode + collegeName 重复',
          rawValue: collegeName,
        });
      }
      seen.add(key);
      const status = normStatus(cell(raw, 'status'));
      if (!status)
        rowErrors.push({
          rowNumber,
          field: 'status',
          message: 'status 仅支持 ACTIVE / DISABLED / INACTIVE',
          rawValue: cell(raw, 'status'),
        });
      const source = normSource(cell(raw, 'source'));
      if (!source)
        rowErrors.push({
          rowNumber,
          field: 'source',
          message: 'source 仅支持 SCHOOL_SITE / MANUAL',
          rawValue: cell(raw, 'source'),
        });
      const confidence = normConfidence(
        cell(raw, 'confidence'),
        source ?? AcademicCollegeSource.MANUAL,
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
        schoolId: school!.id,
        schoolCode,
        schoolName: cell(raw, 'schoolName') || school!.name,
        collegeName,
        collegeCode: opt(cell(raw, 'collegeCode')),
        status: status!,
        source: source!,
        sourceUrl: opt(cell(raw, 'sourceUrl')),
        confidence: confidence!,
        remark: opt(cell(raw, 'remark')),
        mode: existingKeys.has(key) ? 'update' : 'create',
      });
    });
    const previewId = randomUUID();
    cache.set(previewId, { expiresAt: Date.now() + TTL, rows, errors });
    return {
      previewId,
      totalRows: rawRows.length,
      validRows: rows.length,
      createRows: rows.filter((r) => r.mode === 'create').length,
      updateRows: rows.filter((r) => r.mode === 'update').length,
      errorRows: new Set(errors.map((e) => e.rowNumber)).size,
      duplicateRows,
      warnings: [],
      sampleRows: rows.slice(0, 20),
      errors,
    };
  }
  async confirm(previewId: string) {
    const entry = this.getPreview(previewId);
    const now = new Date();
    let created = 0,
      updated = 0;
    for (const row of entry.rows) {
      await this.prisma.academicCollege.upsert({
        where: {
          schoolId_name: { schoolId: row.schoolId, name: row.collegeName },
        },
        create: {
          schoolId: row.schoolId,
          schoolCode: row.schoolCode,
          name: row.collegeName,
          code: row.collegeCode,
          status: row.status,
          source: row.source,
          sourceUrl: row.sourceUrl,
          syncKey: `${row.schoolCode}:${row.collegeName}`,
          confidence: row.confidence,
          lastSyncedAt: now,
          reviewStatus: AcademicCollegeReviewStatus.APPROVED,
          reviewedAt: now,
          remark: row.remark,
        },
        update: {
          schoolCode: row.schoolCode,
          code: row.collegeCode,
          status: row.status,
          source: row.source,
          sourceUrl: row.sourceUrl,
          syncKey: `${row.schoolCode}:${row.collegeName}`,
          confidence: row.confidence,
          lastSyncedAt: now,
          reviewStatus: AcademicCollegeReviewStatus.APPROVED,
          reviewedAt: now,
          remark: row.remark,
        },
      });
      if (row.mode === 'create') created++;
      else updated++;
    }
    cache.delete(previewId);
    return {
      previewId,
      successRows: entry.rows.length,
      createRows: created,
      updateRows: updated,
      failedRows: 0,
    };
  }

  async createCrawlSource(dto: any) {
    const school = await this.findSchool(dto.schoolCode);
    return this.prisma.academicCrawlSource.create({
      data: {
        schoolId: school.id,
        schoolCode: school.code,
        sourceType: 'COLLEGE_PAGE',
        url: String(dto.url),
        enabled: dto.enabled ?? true,
        scope: dto.scope ?? AcademicSyncScope.SOUTHWEST,
        remark: dto.remark ?? null,
      },
    });
  }
  async crawlSources(q: any) {
    const where: any = {};
    if (q.schoolCode) where.schoolCode = q.schoolCode;
    if (q.enabled !== undefined) where.enabled = String(q.enabled) === 'true';
    return this.prisma.academicCrawlSource.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }
  async runCrawl(dto: any) {
    const school = await this.findSchool(dto.schoolCode);
    const url = String(dto.url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'LunwenAcademicDataBot/1.0 low-frequency admin configured',
        },
      });
      const html = await resp.text();
      const candidates = extractCollegeCandidates(html, url);
      const created: unknown[] = [];
      for (const c of candidates) {
        created.push(
          await this.prisma.academicCollegeStaging.create({
            data: {
              schoolId: school.id,
              schoolCode: school.code,
              schoolName: school.name,
              collegeName: c.name,
              collegeUrl: c.url,
              source: AcademicCollegeSource.SCHOOL_SITE,
              sourceUrl: url,
              confidence: c.confidence,
              rawData: c.rawData,
              reviewStatus: AcademicCollegeReviewStatus.PENDING,
            },
          }),
        );
      }
      return {
        schoolCode: school.code,
        url,
        total: candidates.length,
        list: created,
      };
    } catch (e) {
      await this.prisma.academicCollegeStaging.create({
        data: {
          schoolId: school.id,
          schoolCode: school.code,
          schoolName: school.name,
          collegeName: '采集失败',
          source: AcademicCollegeSource.SCHOOL_SITE,
          sourceUrl: url,
          confidence: 0,
          reviewStatus: AcademicCollegeReviewStatus.REJECTED,
          errorMessage: e instanceof Error ? e.message : String(e),
        },
      });
      throw new BadRequestException('学院页面采集失败，请检查 URL 可访问性');
    } finally {
      clearTimeout(timer);
    }
  }
  async staging(q: any) {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 20)));
    const where: any = {};
    if (q.schoolCode) where.schoolCode = q.schoolCode;
    if (q.reviewStatus) where.reviewStatus = q.reviewStatus;
    if (q.confidenceMin) where.confidence = { gte: Number(q.confidenceMin) };
    if (q.provinceCode || q.cityCode) {
      const schools = await this.prisma.academicSchool.findMany({
        where: {
          ...(q.provinceCode ? { provinceCode: q.provinceCode } : {}),
          ...(q.cityCode ? { cityCode: q.cityCode } : {}),
        },
        select: { code: true },
      });
      where.schoolCode = { in: schools.map((s) => s.code).filter(Boolean) };
    }
    const [total, list] = await this.prisma.$transaction([
      this.prisma.academicCollegeStaging.count({ where }),
      this.prisma.academicCollegeStaging.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { list, total, page, pageSize };
  }
  async approve(id: string) {
    const item = await this.prisma.academicCollegeStaging.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException('待审核学院不存在');
    const school = await this.findSchool(item.schoolCode ?? '');
    const college = await this.prisma.academicCollege.upsert({
      where: { schoolId_name: { schoolId: school.id, name: item.collegeName } },
      create: {
        schoolId: school.id,
        schoolCode: school.code,
        name: item.collegeName,
        status: AcademicStatus.ACTIVE,
        source: item.source,
        sourceUrl: item.sourceUrl,
        syncKey: `${school.code}:${item.collegeName}`,
        confidence: item.confidence,
        lastSyncedAt: new Date(),
        reviewStatus: AcademicCollegeReviewStatus.APPROVED,
        reviewedAt: new Date(),
      },
      update: {
        schoolCode: school.code,
        source: item.source,
        sourceUrl: item.sourceUrl,
        confidence: item.confidence,
        lastSyncedAt: new Date(),
        reviewStatus: AcademicCollegeReviewStatus.APPROVED,
        reviewedAt: new Date(),
      },
    });
    await this.prisma.academicCollegeStaging.update({
      where: { id },
      data: {
        reviewStatus: AcademicCollegeReviewStatus.APPROVED,
        reviewedAt: new Date(),
      },
    });
    return college;
  }
  async reject(id: string, reason?: string) {
    return this.prisma.academicCollegeStaging.update({
      where: { id },
      data: {
        reviewStatus: AcademicCollegeReviewStatus.REJECTED,
        reviewedAt: new Date(),
        errorMessage: reason ?? null,
      },
    });
  }
  async batchApprove(ids: string[]) {
    const results: unknown[] = [];
    for (const id of ids) results.push(await this.approve(id));
    return { successRows: results.length, list: results };
  }

  private getPreview(previewId: string) {
    const now = Date.now();
    for (const [id, v] of cache) if (v.expiresAt < now) cache.delete(id);
    const entry = cache.get(previewId);
    if (!entry)
      throw new NotFoundException('预览结果已过期或不存在，请重新上传');
    if (entry.errors.length)
      throw new BadRequestException('预览结果存在错误行，请修正后重新上传');
    return entry;
  }
  private async findSchool(schoolCode: string) {
    const school = await this.prisma.academicSchool.findUnique({
      where: { code: schoolCode },
    });
    if (!school)
      throw new BadRequestException('schoolCode 无法匹配 academic_schools');
    return school;
  }
}
export function extractCollegeCandidates(html: string, baseUrl: string) {
  const anchors = [
    ...html.matchAll(/<a\b[^>]*href=["']?([^"' >]+)["']?[^>]*>(.*?)<\/a>/gis),
  ];
  const seen = new Set<string>();
  const result: {
    name: string;
    url: string;
    confidence: number;
    rawData: any;
  }[] = [];
  for (const m of anchors) {
    const text = strip(m[2]);
    if (
      !text ||
      EXCLUDE.some((x) => text.includes(x)) ||
      !INCLUDE.some((x) => text.includes(x))
    )
      continue;
    const name = text.replace(/^[·\-\s]+/, '').slice(0, 80);
    if (seen.has(name)) continue;
    seen.add(name);
    result.push({
      name,
      url: new URL(m[1], baseUrl).toString(),
      confidence: name.includes('学院') || name.includes('学部') ? 85 : 70,
      rawData: { text, href: m[1] },
    });
  }
  return result.slice(0, 100);
}
function strip(s: string) {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}
function cell(r: RawRow, k: string) {
  return String(r[k] ?? '').trim();
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
function normSource(v: string) {
  const x = (v || 'MANUAL').toUpperCase();
  if (x === 'MANUAL') return AcademicCollegeSource.MANUAL;
  if (x === 'SCHOOL_SITE') return AcademicCollegeSource.SCHOOL_SITE;
  return null;
}
function normConfidence(v: string, source: AcademicCollegeSource) {
  if (!v) return source === AcademicCollegeSource.MANUAL ? 90 : 75;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}
