import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcademicPostgraduateDegreeLevel,
  AcademicPostgraduateProgramReviewStatus,
  AcademicPostgraduateProgramSource,
  AcademicPostgraduateProgramType,
  AcademicPostgraduateStudyMode,
  AcademicStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { parseSchoolFile } from './school-import.service';

const HEADERS = [
  'schoolCode',
  'schoolName',
  'collegeName',
  'disciplineCode',
  'disciplineName',
  'programCode',
  'programName',
  'programType',
  'degreeLevel',
  'researchDirection',
  'studyMode',
  'status',
  'source',
  'sourceVersion',
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
type Row = {
  rowNumber: number;
  schoolId: string;
  schoolCode: string;
  schoolName: string;
  collegeId: string | null;
  collegeName: string | null;
  disciplineCode: string | null;
  disciplineName: string | null;
  programCode: string;
  programName: string;
  programType: AcademicPostgraduateProgramType;
  degreeLevel: AcademicPostgraduateDegreeLevel;
  researchDirection: string | null;
  studyMode: AcademicPostgraduateStudyMode;
  status: AcademicStatus;
  source: AcademicPostgraduateProgramSource;
  sourceVersion: string | null;
  sourceUrl: string | null;
  confidence: number;
  remark: string | null;
  rawData?: unknown;
  syncKey: string;
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
export class PostgraduateProgramService {
  constructor(private readonly prisma: PrismaService) {}
  template() {
    const ex = [
      '4150010637',
      '重庆师范大学',
      '计算机与信息科学学院',
      '0812',
      '计算机科学与技术',
      '081200',
      '计算机科学与技术',
      'ACADEMIC',
      'MASTER',
      '人工智能与教育技术',
      'FULL_TIME',
      'ACTIVE',
      'MANUAL',
      '2026',
      '',
      '90',
      '示例',
    ];
    return `${HEADERS.join(',')}\n${ex.map(csvEscape).join(',')}\n`;
  }

  async list(query: Record<string, string>) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20), 1), 100);
    const schoolCodes = await this.schoolCodesByArea(query);
    const where: Record<string, unknown> = {};
    if (query.schoolCode) where.schoolCode = query.schoolCode;
    else if (schoolCodes) where.schoolCode = { in: schoolCodes };
    if (query.collegeName)
      where.collegeName = { contains: query.collegeName, mode: 'insensitive' };
    if (query.disciplineCode) where.disciplineCode = query.disciplineCode;
    if (query.programType) where.programType = query.programType;
    if (query.degreeLevel) where.degreeLevel = query.degreeLevel;
    if (query.studyMode) where.studyMode = query.studyMode;
    if (query.status) where.status = normalizeStatus(query.status) ?? undefined;
    if (query.keyword)
      where.OR = [
        { programName: { contains: query.keyword, mode: 'insensitive' } },
        { programCode: { contains: query.keyword, mode: 'insensitive' } },
        { researchDirection: { contains: query.keyword, mode: 'insensitive' } },
        { collegeName: { contains: query.keyword, mode: 'insensitive' } },
      ];
    const [items, total] = await Promise.all([
      this.prisma.academicPostgraduateProgram.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.academicPostgraduateProgram.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async preview(
    file:
      | { originalname?: string; mimetype?: string; buffer?: Buffer }
      | undefined,
  ): Promise<Preview> {
    if (!file?.buffer?.length)
      throw new BadRequestException('请上传研究生招生专业 Excel 或 CSV 文件');
    const rawRows = await parseSchoolFile(file);
    const errors: Err[] = [];
    const warnings: string[] = [];
    const rows: Row[] = [];
    const seen = new Set<string>();
    let duplicateRows = 0;
    const schoolCodes = uniq(
      rawRows.map((r) => cell(r, 'schoolCode')).filter(Boolean),
    );
    const schools = await this.prisma.academicSchool.findMany({
      where: { code: { in: schoolCodes } },
      select: { id: true, code: true, name: true },
    });
    const schoolMap = new Map(schools.map((s) => [s.code!, s]));
    const disciplineCodes = uniq(
      rawRows.map((r) => cell(r, 'disciplineCode')).filter(Boolean),
    );
    const disciplineNames = uniq(
      rawRows.map((r) => cell(r, 'disciplineName')).filter(Boolean),
    );
    const disciplines = await this.prisma.academicDisciplineCatalog.findMany({
      where: {
        OR: [
          { code: { in: disciplineCodes } },
          { name: { in: disciplineNames } },
        ],
      },
      select: { id: true, code: true, name: true },
    });
    const discByCode = new Map(disciplines.map((d) => [d.code, d]));
    const discByName = new Map(disciplines.map((d) => [d.name, d]));
    const colleges = await this.prisma.academicCollege.findMany({
      where: { schoolCode: { in: schoolCodes } },
      select: { id: true, schoolCode: true, name: true },
    });
    const collegeMap = new Map(
      colleges.map((c) => [`${c.schoolCode}:${c.name}`, c]),
    );
    const existing = await this.prisma.academicPostgraduateProgram.findMany({
      where: { schoolCode: { in: schoolCodes } },
      select: { syncKey: true },
    });
    const existingKeys = new Set(existing.map((x) => x.syncKey));
    rawRows.forEach((raw, index) => {
      const rowNumber = index + 2;
      const rowErrors: Err[] = [];
      const rowWarnings: string[] = [];
      const schoolCode = cell(raw, 'schoolCode');
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
      let discipline = cell(raw, 'disciplineCode')
        ? discByCode.get(cell(raw, 'disciplineCode'))
        : undefined;
      if (!discipline && cell(raw, 'disciplineName'))
        discipline = discByName.get(cell(raw, 'disciplineName'));
      if (cell(raw, 'disciplineCode') && !discipline)
        rowWarnings.push('disciplineCode 未匹配研究生学科目录，将保留导入文本');
      const programCode = cell(raw, 'programCode');
      const programName = cell(raw, 'programName');
      if (!programCode)
        rowErrors.push({
          rowNumber,
          field: 'programCode',
          message: 'programCode 必填',
        });
      if (!programName)
        rowErrors.push({
          rowNumber,
          field: 'programName',
          message: 'programName 必填',
        });
      const programType = normalizeEnum(
        AcademicPostgraduateProgramType,
        cell(raw, 'programType') || 'ACADEMIC',
      ) as AcademicPostgraduateProgramType | null;
      if (!programType)
        rowErrors.push({
          rowNumber,
          field: 'programType',
          message: 'programType 仅支持 ACADEMIC / PROFESSIONAL',
          rawValue: cell(raw, 'programType'),
        });
      const degreeLevel = normalizeEnum(
        AcademicPostgraduateDegreeLevel,
        cell(raw, 'degreeLevel'),
      ) as AcademicPostgraduateDegreeLevel | null;
      if (!degreeLevel)
        rowErrors.push({
          rowNumber,
          field: 'degreeLevel',
          message: 'degreeLevel 仅支持 MASTER / DOCTOR',
          rawValue: cell(raw, 'degreeLevel'),
        });
      const studyMode = normalizeEnum(
        AcademicPostgraduateStudyMode,
        cell(raw, 'studyMode') || 'UNKNOWN',
      ) as AcademicPostgraduateStudyMode | null;
      if (!studyMode)
        rowErrors.push({
          rowNumber,
          field: 'studyMode',
          message: 'studyMode 仅支持 FULL_TIME / PART_TIME / UNKNOWN',
          rawValue: cell(raw, 'studyMode'),
        });
      const status = normalizeStatus(cell(raw, 'status'));
      if (!status)
        rowErrors.push({
          rowNumber,
          field: 'status',
          message: 'status 仅支持 ACTIVE / DISABLED / INACTIVE',
          rawValue: cell(raw, 'status'),
        });
      const source = normalizeEnum(
        AcademicPostgraduateProgramSource,
        cell(raw, 'source') || 'MANUAL',
      ) as AcademicPostgraduateProgramSource | null;
      if (!source)
        rowErrors.push({
          rowNumber,
          field: 'source',
          message:
            'source 仅支持 YZ_CHSI / GRADUATE_SCHOOL / ADMISSION_BROCHURE / MANUAL',
          rawValue: cell(raw, 'source'),
        });
      const confidence = normalizeConfidence(
        cell(raw, 'confidence'),
        source ?? AcademicPostgraduateProgramSource.MANUAL,
      );
      if (confidence === null)
        rowErrors.push({
          rowNumber,
          field: 'confidence',
          message: 'confidence 必须为 0-100',
          rawValue: cell(raw, 'confidence'),
        });
      const collegeName = optional(cell(raw, 'collegeName'));
      const college =
        schoolCode && collegeName
          ? collegeMap.get(`${schoolCode}:${collegeName}`)
          : undefined;
      if (collegeName && !college)
        rowWarnings.push('collegeName 未匹配学院库，将保留文本');
      const syncKey = buildSyncKey(
        schoolCode,
        collegeName,
        programCode,
        degreeLevel ?? 'MASTER',
        optional(cell(raw, 'researchDirection')),
      );
      if (seen.has(syncKey)) {
        duplicateRows += 1;
        rowErrors.push({
          rowNumber,
          field: 'programCode',
          message:
            '文件中存在重复 schoolCode + collegeName + programCode + degreeLevel + researchDirection',
          rawValue: syncKey,
        });
      }
      seen.add(syncKey);
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
        disciplineCode:
          discipline?.code ?? optional(cell(raw, 'disciplineCode')),
        disciplineName:
          discipline?.name ?? optional(cell(raw, 'disciplineName')),
        programCode,
        programName,
        programType: programType!,
        degreeLevel: degreeLevel!,
        researchDirection: optional(cell(raw, 'researchDirection')),
        studyMode: studyMode!,
        status: status!,
        source: source!,
        sourceVersion: optional(cell(raw, 'sourceVersion')),
        sourceUrl: optional(cell(raw, 'sourceUrl')),
        confidence: confidence!,
        remark: optional(cell(raw, 'remark')),
        syncKey,
        warnings: rowWarnings,
        mode: existingKeys.has(syncKey) ? 'update' : 'create',
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
        schoolName: row.schoolName,
        collegeId: row.collegeId,
        collegeName: row.collegeName,
        disciplineCode: row.disciplineCode,
        disciplineName: row.disciplineName,
        programCode: row.programCode,
        programName: row.programName,
        programType: row.programType,
        degreeLevel: row.degreeLevel,
        researchDirection: row.researchDirection,
        studyMode: row.studyMode,
        status: row.status,
        source: row.source,
        sourceVersion: row.sourceVersion,
        sourceUrl: row.sourceUrl,
        syncKey: row.syncKey,
        confidence: row.confidence,
        lastSyncedAt: new Date(),
        reviewStatus: AcademicPostgraduateProgramReviewStatus.APPROVED,
        reviewedAt: new Date(),
        remark: row.remark,
      };
      await this.prisma.academicPostgraduateProgram.upsert({
        where: { syncKey: row.syncKey },
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
    const degreeLevel = normalizeEnum(
      AcademicPostgraduateDegreeLevel,
      typeof dto.degreeLevel === 'string' ? dto.degreeLevel : 'MASTER',
    ) as AcademicPostgraduateDegreeLevel | null;
    const source = normalizeEnum(
      AcademicPostgraduateProgramSource,
      typeof dto.sourceType === 'string' ? dto.sourceType : 'GRADUATE_SCHOOL',
    ) as AcademicPostgraduateProgramSource | null;
    if (!schoolCode || !url)
      throw new BadRequestException('schoolCode 和 url 必填');
    if (!degreeLevel)
      throw new BadRequestException('degreeLevel 仅支持 MASTER / DOCTOR');
    if (!source || source === AcademicPostgraduateProgramSource.MANUAL)
      throw new BadRequestException(
        'sourceType 仅支持 YZ_CHSI / GRADUATE_SCHOOL / ADMISSION_BROCHURE',
      );
    const school = await this.prisma.academicSchool.findUnique({
      where: { code: schoolCode },
    });
    if (!school) throw new BadRequestException('schoolCode 未匹配高校库');
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'lunwen-postgraduate-program-crawler/1.0' },
    });
    if (!response.ok)
      throw new BadRequestException(`采集页面请求失败：${response.status}`);
    const html = await response.text();
    const htmlText = stripHtml(html);
    const disciplines = await this.prisma.academicDisciplineCatalog.findMany({
      where: { educationLevels: { has: degreeLevel } },
      select: { code: true, name: true, type: true },
    });
    const colleges = await this.prisma.academicCollege.findMany({
      where: { schoolCode },
      select: { id: true, name: true },
    });
    const candidates = extractPostgraduateProgramCandidates(
      html,
      disciplines.map((d) => ({ code: d.code, name: d.name })),
    );
    const matchedCollege = colleges.find((c) => htmlText.includes(c.name));
    for (const c of candidates.slice(0, 100))
      await this.prisma.academicPostgraduateProgramStaging.create({
        data: {
          schoolId: school.id,
          schoolCode,
          schoolName: school.name,
          collegeId: matchedCollege?.id ?? null,
          collegeName: c.collegeName ?? matchedCollege?.name ?? null,
          disciplineCode: c.disciplineCode,
          disciplineName: c.disciplineName,
          programCode: c.programCode,
          programName: c.programName,
          programType: c.programType,
          degreeLevel,
          researchDirection: c.researchDirection,
          studyMode: c.studyMode,
          source,
          sourceUrl: url,
          confidence: c.confidence,
          rawData: {
            url,
            extractedAt: new Date().toISOString(),
            text: c.rawText,
          },
        },
      });
    return { created: candidates.length, sampleRows: candidates.slice(0, 20) };
  }

  async staging(query: Record<string, string>) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20), 1), 100);
    const schoolCodes = await this.schoolCodesByArea(query);
    const where: Record<string, unknown> = {};
    if (query.schoolCode) where.schoolCode = query.schoolCode;
    else if (schoolCodes) where.schoolCode = { in: schoolCodes };
    if (query.reviewStatus) where.reviewStatus = query.reviewStatus;
    if (query.degreeLevel) where.degreeLevel = query.degreeLevel;
    const [items, total] = await Promise.all([
      this.prisma.academicPostgraduateProgramStaging.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.academicPostgraduateProgramStaging.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async approve(id: string) {
    const item =
      await this.prisma.academicPostgraduateProgramStaging.findUnique({
        where: { id },
      });
    if (!item) throw new NotFoundException('待审核研究生招生专业不存在');
    if (!item.schoolId || !item.schoolCode || !item.programCode)
      throw new BadRequestException(
        '待审核数据缺少 schoolCode 或 programCode，无法入正式表',
      );
    const syncKey = buildSyncKey(
      item.schoolCode,
      item.collegeName,
      item.programCode,
      item.degreeLevel,
      item.researchDirection,
    );
    await this.prisma.academicPostgraduateProgram.upsert({
      where: { syncKey },
      create: {
        schoolId: item.schoolId,
        schoolCode: item.schoolCode,
        schoolName: item.schoolName,
        collegeId: item.collegeId,
        collegeName: item.collegeName,
        disciplineCode: item.disciplineCode,
        disciplineName: item.disciplineName,
        programCode: item.programCode,
        programName: item.programName,
        programType: item.programType,
        degreeLevel: item.degreeLevel,
        researchDirection: item.researchDirection,
        studyMode: item.studyMode,
        status: AcademicStatus.ACTIVE,
        source: item.source,
        sourceUrl: item.sourceUrl,
        syncKey,
        confidence: item.confidence,
        lastSyncedAt: new Date(),
        reviewStatus: AcademicPostgraduateProgramReviewStatus.APPROVED,
        reviewedAt: new Date(),
        rawData: (item.rawData ?? undefined) as never,
      },
      update: {
        collegeId: item.collegeId,
        collegeName: item.collegeName,
        disciplineCode: item.disciplineCode,
        disciplineName: item.disciplineName,
        programName: item.programName,
        programType: item.programType,
        researchDirection: item.researchDirection,
        studyMode: item.studyMode,
        source: item.source,
        sourceUrl: item.sourceUrl,
        confidence: item.confidence,
        lastSyncedAt: new Date(),
        reviewStatus: AcademicPostgraduateProgramReviewStatus.APPROVED,
        reviewedAt: new Date(),
        rawData: (item.rawData ?? undefined) as never,
      },
    });
    return this.prisma.academicPostgraduateProgramStaging.update({
      where: { id },
      data: {
        reviewStatus: AcademicPostgraduateProgramReviewStatus.APPROVED,
        reviewedAt: new Date(),
      },
    });
  }
  async reject(id: string, reason?: string) {
    return this.prisma.academicPostgraduateProgramStaging.update({
      where: { id },
      data: {
        reviewStatus: AcademicPostgraduateProgramReviewStatus.REJECTED,
        reviewedAt: new Date(),
        errorMessage: reason ?? null,
      },
    });
  }
  async batchApprove(ids: string[]) {
    let successRows = 0;
    for (const id of ids) {
      await this.approve(id);
      successRows++;
    }
    return { successRows };
  }

  async getPostgraduateContext(params: {
    schoolCode: string;
    collegeName?: string;
    disciplineCode?: string;
    programName?: string;
    degreeLevel?: string;
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
    if (params.disciplineCode) where.disciplineCode = params.disciplineCode;
    if (params.programName)
      where.programName = { contains: params.programName, mode: 'insensitive' };
    if (params.degreeLevel) where.degreeLevel = params.degreeLevel;
    const postgraduatePrograms =
      await this.prisma.academicPostgraduateProgram.findMany({
        where,
        orderBy: [{ confidence: 'desc' }],
        take: 30,
      });
    const discipline = postgraduatePrograms[0]?.disciplineCode
      ? await this.prisma.academicDisciplineCatalog.findUnique({
          where: { code: postgraduatePrograms[0].disciplineCode },
        })
      : null;
    return {
      school,
      college: postgraduatePrograms[0]?.collegeName ?? null,
      discipline,
      postgraduatePrograms,
      researchDirections: uniq(
        postgraduatePrograms
          .map((p) => p.researchDirection)
          .filter(Boolean) as string[],
      ),
      source: postgraduatePrograms[0]?.source ?? null,
      confidence: postgraduatePrograms[0]?.confidence ?? null,
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

export type ExtractedPostgraduateProgram = {
  collegeName: string | null;
  disciplineCode: string | null;
  disciplineName: string | null;
  programCode: string;
  programName: string;
  programType: AcademicPostgraduateProgramType;
  researchDirection: string | null;
  studyMode: AcademicPostgraduateStudyMode;
  confidence: number;
  rawText: string;
};
export function extractPostgraduateProgramCandidates(
  html: string,
  knownDisciplines: Array<{ code: string; name: string }> = [],
): ExtractedPostgraduateProgram[] {
  const text = stripHtml(html);
  const rows = text
    .split(/[\n；;。]/)
    .map((x) => x.trim())
    .filter(Boolean);
  const out = new Map<string, ExtractedPostgraduateProgram>();
  for (const row of rows) {
    const code = row.match(/\b\d{4,6}\b/)?.[0];
    const known = knownDisciplines.find(
      (d) => row.includes(d.name) || (code && code.startsWith(d.code)),
    );
    const name =
      known?.name ??
      row.match(
        /[\u4e00-\u9fa5]{2,30}(?:学|工程|教育|医学|管理|艺术|法律|电子信息|计算机科学与技术)/,
      )?.[0];
    if (!code && !name) continue;
    const direction =
      row.match(
        /(?:方向|研究方向)[:：]?([\u4e00-\u9fa5A-Za-z0-9（）()·-]{2,40})/,
      )?.[1] ?? null;
    const studyMode = row.includes('非全日制')
      ? AcademicPostgraduateStudyMode.PART_TIME
      : row.includes('全日制')
        ? AcademicPostgraduateStudyMode.FULL_TIME
        : AcademicPostgraduateStudyMode.UNKNOWN;
    const programType = /专硕|专业学位|专业型/.test(row)
      ? AcademicPostgraduateProgramType.PROFESSIONAL
      : AcademicPostgraduateProgramType.ACADEMIC;
    const programCode = code ?? known?.code ?? 'UNKNOWN';
    const programName = name ?? known?.name ?? row.slice(0, 30);
    const key = `${programCode}:${programName}:${direction ?? ''}`;
    out.set(key, {
      collegeName: null,
      disciplineCode: known?.code ?? code?.slice(0, 4) ?? null,
      disciplineName: known?.name ?? null,
      programCode,
      programName,
      programType,
      researchDirection: direction,
      studyMode,
      confidence: code && known ? 88 : known ? 80 : 60,
      rawText: row,
    });
  }
  return Array.from(out.values()).slice(0, 100);
}
function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>|<\/p>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&amp;/g, ' ')
    .replace(/\s+/g, ' ');
}
function cell(row: RawRow, k: string) {
  return String(row[k] ?? '').trim();
}
function optional(v: string) {
  return v.trim() ? v.trim() : null;
}
function uniq<T>(a: T[]) {
  return Array.from(new Set(a));
}
function normalizeStatus(v: string): AcademicStatus | null {
  const x = (v || 'ACTIVE').trim().toUpperCase();
  if (x === 'ACTIVE') return AcademicStatus.ACTIVE;
  if (x === 'DISABLED' || x === 'INACTIVE') return AcademicStatus.INACTIVE;
  return null;
}
function normalizeEnum(e: Record<string, string>, v: string) {
  const x = (v || '').trim().toUpperCase();
  return Object.values(e).includes(x) ? x : null;
}
function normalizeConfidence(
  v: string,
  source: AcademicPostgraduateProgramSource,
) {
  if (!v) return source === AcademicPostgraduateProgramSource.MANUAL ? 90 : 80;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}
function buildSyncKey(
  schoolCode: string,
  collegeName: string | null,
  programCode: string,
  degreeLevel: string,
  researchDirection: string | null,
) {
  return [
    schoolCode,
    collegeName ?? '',
    programCode,
    degreeLevel,
    researchDirection ?? '',
  ].join(':');
}
function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
