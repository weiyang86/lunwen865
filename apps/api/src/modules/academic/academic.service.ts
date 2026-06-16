import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcademicStatus, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCollegeDto,
  CreateDisciplineCategoryDto,
  CreateDisciplineLevelOneDto,
  CreateDisciplineLevelTwoDto,
  CreateMajorDto,
  CreateSchoolDto,
  ListAcademicDto,
  QueryCollegesDto,
  QueryMajorsDto,
  QuerySchoolsDto,
  UpdateCollegeDto,
  UpdateDisciplineCategoryDto,
  UpdateDisciplineLevelOneDto,
  UpdateDisciplineLevelTwoDto,
  UpdateMajorDto,
  UpdateSchoolDto,
} from './dto/academic.dto';

const MAX_PAGE_SIZE = 100;

type PageInput = { page?: number; pageSize?: number };

type ImportIssue = {
  sheet: string;
  row: number;
  message: string;
};

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  issues: ImportIssue[];
};

function pageArgs(q: PageInput) {
  const page = Math.max(1, Number(q.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(q.pageSize ?? 20)),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function cleanCode(value?: string | null) {
  const s = value?.trim();
  return s ? s : null;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const r = value as any;
    if (typeof r.text === 'string') return r.text.trim();
    if (typeof r.result === 'string') return r.result.trim();
    if (typeof r.result === 'number') return String(r.result);
    if (Array.isArray(r.richText))
      return r.richText.map((x: any) => String(x?.text ?? '')).join('').trim();
  }
  return String(value).trim();
}

function toStatus(value: string | null | undefined) {
  const s = (value ?? '').trim().toUpperCase();
  if (!s) return AcademicStatus.ACTIVE;
  if (s === 'ACTIVE') return AcademicStatus.ACTIVE;
  if (s === 'INACTIVE') return AcademicStatus.INACTIVE;
  throw new BadRequestException('status 只支持 ACTIVE / INACTIVE');
}

function toInt(value: string, fallback = 0) {
  const s = value.trim();
  if (!s) return fallback;
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

async function workbookToBuffer(wb: ExcelJS.Workbook) {
  const data = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(data) ? data : Buffer.from(data as any);
}

@Injectable()
export class AcademicService {
  constructor(private readonly prisma: PrismaService) {}

  private handleUniqueError(e: unknown): never {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      throw new BadRequestException('基础数据编码或名称已存在，请检查后重试');
    }
    throw e;
  }

  async listProvinces(status = AcademicStatus.ACTIVE) {
    return this.prisma.academicProvince.findMany({
      where: { status },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listCities(provinceId: string, status = AcademicStatus.ACTIVE) {
    return this.prisma.academicCity.findMany({
      where: { provinceId, status },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listSchools(q: QuerySchoolsDto, publicOnly = true) {
    const { page, pageSize, skip, take } = pageArgs(q);
    const where: Prisma.AcademicSchoolWhereInput = publicOnly
      ? { status: AcademicStatus.ACTIVE }
      : {};
    if (!publicOnly && q.status) where.status = q.status;
    if (q.provinceId) where.provinceId = q.provinceId;
    if (q.cityId) where.cityId = q.cityId;
    if (q.keyword?.trim()) {
      const keyword = q.keyword.trim();
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
      ];
    }
    const [total, list] = await this.prisma.$transaction([
      this.prisma.academicSchool.count({ where }),
      this.prisma.academicSchool.findMany({
        where,
        include: { province: true, city: true },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take,
      }),
    ]);
    return { list, total, page, pageSize };
  }

  async listColleges(q: QueryCollegesDto, publicOnly = true) {
    const { page, pageSize, skip, take } = pageArgs(q);
    const where: Prisma.AcademicCollegeWhereInput = {};
    if (q.schoolId) where.schoolId = q.schoolId;
    if (publicOnly) where.status = AcademicStatus.ACTIVE;
    else if (q.status) where.status = q.status;
    if (q.keyword?.trim()) {
      const keyword = q.keyword.trim();
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
      ];
    }
    const [total, list] = await this.prisma.$transaction([
      this.prisma.academicCollege.count({ where }),
      this.prisma.academicCollege.findMany({
        where,
        include: { school: true },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take,
      }),
    ]);
    return { list, total, page, pageSize };
  }

  async listMajors(q: QueryMajorsDto, publicOnly = true) {
    const { page, pageSize, skip, take } = pageArgs(q);
    const where: Prisma.AcademicMajorWhereInput = publicOnly
      ? { status: AcademicStatus.ACTIVE }
      : {};
    if (!publicOnly && q.status) where.status = q.status;
    if (q.schoolId) where.schoolId = q.schoolId;
    if (q.collegeId) where.collegeId = q.collegeId;
    if (q.educationLevel) where.educationLevel = q.educationLevel;
    if (q.keyword?.trim()) {
      const keyword = q.keyword.trim();
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
      ];
    }
    const [total, list] = await this.prisma.$transaction([
      this.prisma.academicMajor.count({ where }),
      this.prisma.academicMajor.findMany({
        where,
        include: {
          school: true,
          college: true,
          disciplineCategory: true,
          disciplineLevelOne: true,
          disciplineLevelTwo: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take,
      }),
    ]);
    return { list, total, page, pageSize };
  }

  async listDisciplineCategories(status = AcademicStatus.ACTIVE) {
    return this.prisma.disciplineCategory.findMany({
      where: { status },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listDisciplineLevelOnes(
    categoryId: string,
    status = AcademicStatus.ACTIVE,
  ) {
    return this.prisma.disciplineLevelOne.findMany({
      where: { categoryId, status },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listDisciplineLevelTwos(
    levelOneId: string,
    status = AcademicStatus.ACTIVE,
  ) {
    return this.prisma.disciplineLevelTwo.findMany({
      where: { levelOneId, status },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listDisciplines(q: ListAcademicDto) {
    const status = q.status;
    const [categories, levelOnes, levelTwos] = await this.prisma.$transaction([
      this.prisma.disciplineCategory.findMany({
        where: status ? { status } : {},
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.disciplineLevelOne.findMany({
        where: status ? { status } : {},
        include: { category: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.disciplineLevelTwo.findMany({
        where: status ? { status } : {},
        include: { levelOne: { include: { category: true } } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);
    return { categories, levelOnes, levelTwos };
  }

  async createSchool(dto: CreateSchoolDto) {
    try {
      return await this.prisma.academicSchool.create({
        data: {
          provinceId: dto.provinceId,
          cityId: dto.cityId,
          name: dto.name.trim(),
          code: cleanCode(dto.code),
          schoolType: cleanCode(dto.schoolType),
          educationLevels: dto.educationLevels ?? [],
          status: dto.status ?? AcademicStatus.ACTIVE,
          sortOrder: dto.sortOrder ?? 0,
          remark: dto.remark ?? null,
        },
      });
    } catch (e) {
      this.handleUniqueError(e);
    }
  }

  async updateSchool(id: string, dto: UpdateSchoolDto) {
    await this.ensureSchool(id);
    try {
      return await this.prisma.academicSchool.update({
        where: { id },
        data: {
          provinceId: dto.provinceId ?? undefined,
          cityId: dto.cityId ?? undefined,
          name: dto.name?.trim() ?? undefined,
          code: dto.code === undefined ? undefined : cleanCode(dto.code),
          schoolType:
            dto.schoolType === undefined
              ? undefined
              : cleanCode(dto.schoolType),
          educationLevels: dto.educationLevels ?? undefined,
          status: dto.status ?? undefined,
          sortOrder: dto.sortOrder ?? undefined,
          remark: dto.remark ?? undefined,
        },
      });
    } catch (e) {
      this.handleUniqueError(e);
    }
  }

  async disableSchool(id: string) {
    await this.ensureSchool(id);
    return this.prisma.academicSchool.update({
      where: { id },
      data: { status: AcademicStatus.INACTIVE },
    });
  }

  async createCollege(dto: CreateCollegeDto) {
    try {
      return await this.prisma.academicCollege.create({
        data: {
          schoolId: dto.schoolId,
          name: dto.name.trim(),
          code: cleanCode(dto.code),
          status: dto.status ?? AcademicStatus.ACTIVE,
          sortOrder: dto.sortOrder ?? 0,
          remark: dto.remark ?? null,
        },
      });
    } catch (e) {
      this.handleUniqueError(e);
    }
  }

  async updateCollege(id: string, dto: UpdateCollegeDto) {
    await this.ensureCollege(id);
    try {
      return await this.prisma.academicCollege.update({
        where: { id },
        data: {
          schoolId: dto.schoolId ?? undefined,
          name: dto.name?.trim() ?? undefined,
          code: dto.code === undefined ? undefined : cleanCode(dto.code),
          status: dto.status ?? undefined,
          sortOrder: dto.sortOrder ?? undefined,
          remark: dto.remark ?? undefined,
        },
      });
    } catch (e) {
      this.handleUniqueError(e);
    }
  }

  async disableCollege(id: string) {
    await this.ensureCollege(id);
    return this.prisma.academicCollege.update({
      where: { id },
      data: { status: AcademicStatus.INACTIVE },
    });
  }

  async createMajor(dto: CreateMajorDto) {
    try {
      return await this.prisma.academicMajor.create({
        data: this.majorCreateData(dto),
      });
    } catch (e) {
      this.handleUniqueError(e);
    }
  }

  async updateMajor(id: string, dto: UpdateMajorDto) {
    await this.ensureMajor(id);
    try {
      return await this.prisma.academicMajor.update({
        where: { id },
        data: this.majorUpdateData(dto),
      });
    } catch (e) {
      this.handleUniqueError(e);
    }
  }

  async disableMajor(id: string) {
    await this.ensureMajor(id);
    return this.prisma.academicMajor.update({
      where: { id },
      data: { status: AcademicStatus.INACTIVE },
    });
  }

  async createDisciplineCategory(dto: CreateDisciplineCategoryDto) {
    try {
      return await this.prisma.disciplineCategory.create({
        data: {
          name: dto.name.trim(),
          code: dto.code.trim(),
          status: dto.status ?? AcademicStatus.ACTIVE,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (e) {
      this.handleUniqueError(e);
    }
  }

  async updateDisciplineCategory(id: string, dto: UpdateDisciplineCategoryDto) {
    await this.ensureCategory(id);
    try {
      return await this.prisma.disciplineCategory.update({
        where: { id },
        data: {
          name: dto.name?.trim() ?? undefined,
          code: dto.code?.trim() ?? undefined,
          status: dto.status ?? undefined,
          sortOrder: dto.sortOrder ?? undefined,
        },
      });
    } catch (e) {
      this.handleUniqueError(e);
    }
  }

  async disableDisciplineCategory(id: string) {
    await this.ensureCategory(id);
    return this.prisma.disciplineCategory.update({
      where: { id },
      data: { status: AcademicStatus.INACTIVE },
    });
  }

  async createDisciplineLevelOne(dto: CreateDisciplineLevelOneDto) {
    try {
      return await this.prisma.disciplineLevelOne.create({
        data: {
          categoryId: dto.categoryId,
          name: dto.name.trim(),
          code: dto.code.trim(),
          status: dto.status ?? AcademicStatus.ACTIVE,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (e) {
      this.handleUniqueError(e);
    }
  }

  async updateDisciplineLevelOne(id: string, dto: UpdateDisciplineLevelOneDto) {
    await this.ensureLevelOne(id);
    try {
      return await this.prisma.disciplineLevelOne.update({
        where: { id },
        data: {
          categoryId: dto.categoryId ?? undefined,
          name: dto.name?.trim() ?? undefined,
          code: dto.code?.trim() ?? undefined,
          status: dto.status ?? undefined,
          sortOrder: dto.sortOrder ?? undefined,
        },
      });
    } catch (e) {
      this.handleUniqueError(e);
    }
  }

  async disableDisciplineLevelOne(id: string) {
    await this.ensureLevelOne(id);
    return this.prisma.disciplineLevelOne.update({
      where: { id },
      data: { status: AcademicStatus.INACTIVE },
    });
  }

  async createDisciplineLevelTwo(dto: CreateDisciplineLevelTwoDto) {
    try {
      return await this.prisma.disciplineLevelTwo.create({
        data: {
          levelOneId: dto.levelOneId,
          name: dto.name.trim(),
          code: dto.code.trim(),
          status: dto.status ?? AcademicStatus.ACTIVE,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (e) {
      this.handleUniqueError(e);
    }
  }

  async updateDisciplineLevelTwo(id: string, dto: UpdateDisciplineLevelTwoDto) {
    await this.ensureLevelTwo(id);
    try {
      return await this.prisma.disciplineLevelTwo.update({
        where: { id },
        data: {
          levelOneId: dto.levelOneId ?? undefined,
          name: dto.name?.trim() ?? undefined,
          code: dto.code?.trim() ?? undefined,
          status: dto.status ?? undefined,
          sortOrder: dto.sortOrder ?? undefined,
        },
      });
    } catch (e) {
      this.handleUniqueError(e);
    }
  }

  async disableDisciplineLevelTwo(id: string) {
    await this.ensureLevelTwo(id);
    return this.prisma.disciplineLevelTwo.update({
      where: { id },
      data: { status: AcademicStatus.INACTIVE },
    });
  }

  async buildSchoolImportTemplate() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Schools');
    ws.addRow([
      'provinceCode',
      'cityCode',
      'name',
      'code',
      'schoolType',
      'educationLevels',
      'status',
      'sortOrder',
      'remark',
    ]);
    ws.addRow([
      '110000',
      '110100',
      '示例大学',
      'DEMO-SCHOOL',
      '本科',
      'UNDERGRADUATE,MASTER',
      'ACTIVE',
      '0',
      '',
    ]);
    return workbookToBuffer(wb);
  }

  async buildCollegeImportTemplate() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Colleges');
    ws.addRow([
      'schoolCode',
      'schoolName',
      'name',
      'code',
      'status',
      'sortOrder',
      'remark',
    ]);
    ws.addRow(['DEMO-SCHOOL', '示例大学', '示例学院', 'DEMO-COLLEGE', 'ACTIVE', '0', '']);
    return workbookToBuffer(wb);
  }

  async buildMajorImportTemplate() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Majors');
    ws.addRow([
      'schoolCode',
      'schoolName',
      'collegeCode',
      'collegeName',
      'name',
      'code',
      'educationLevel',
      'disciplineCategoryCode',
      'disciplineLevelOneCode',
      'disciplineLevelTwoCode',
      'status',
      'sortOrder',
      'remark',
    ]);
    ws.addRow([
      'DEMO-SCHOOL',
      '示例大学',
      'DEMO-COLLEGE',
      '示例学院',
      '示例专业',
      'DEMO-MAJOR',
      'UNDERGRADUATE',
      '08',
      '0801',
      '080101',
      'ACTIVE',
      '0',
      '',
    ]);
    return workbookToBuffer(wb);
  }

  async buildDisciplineImportTemplate() {
    const wb = new ExcelJS.Workbook();

    const categories = wb.addWorksheet('Categories');
    categories.addRow(['code', 'name', 'status', 'sortOrder']);
    categories.addRow(['08', '工学', 'ACTIVE', '0']);

    const levelOnes = wb.addWorksheet('LevelOnes');
    levelOnes.addRow(['categoryCode', 'code', 'name', 'status', 'sortOrder']);
    levelOnes.addRow(['08', '0801', '计算机科学与技术', 'ACTIVE', '0']);

    const levelTwos = wb.addWorksheet('LevelTwos');
    levelTwos.addRow([
      'categoryCode',
      'levelOneCode',
      'code',
      'name',
      'status',
      'sortOrder',
    ]);
    levelTwos.addRow(['08', '0801', '080101', '计算机科学与技术', 'ACTIVE', '0']);

    return workbookToBuffer(wb);
  }

  async importSchoolsFromExcel(buffer: Buffer): Promise<ImportResult> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.getWorksheet('Schools') ?? wb.worksheets[0];
    if (!ws) throw new BadRequestException('Excel 内容为空');

    const provinces = await this.prisma.academicProvince.findMany({
      select: { id: true, code: true },
    });
    const cities = await this.prisma.academicCity.findMany({
      select: { id: true, provinceId: true, code: true },
    });
    const provinceByCode = new Map(provinces.map((p) => [p.code, p.id]));
    const cityByProvCode = new Map(
      cities.map((c) => [`${c.provinceId}:${c.code}`, c.id]),
    );

    const headerRow = ws.getRow(1);
    const headerIndex = new Map<string, number>();
    headerRow.eachCell((cell, col) => {
      const key = cellText(cell.value).trim();
      if (key) headerIndex.set(key, col);
    });

    const issues: ImportIssue[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 2; i <= ws.rowCount; i += 1) {
      const row = ws.getRow(i);
      const provinceCode = cellText(
        row.getCell(headerIndex.get('provinceCode') ?? 1).value,
      );
      const cityCode = cellText(
        row.getCell(headerIndex.get('cityCode') ?? 2).value,
      );
      const name = cellText(row.getCell(headerIndex.get('name') ?? 3).value);
      const code = cellText(row.getCell(headerIndex.get('code') ?? 4).value);

      const hasAny =
        provinceCode || cityCode || name || code || row.cellCount > 0;
      if (!hasAny) continue;
      if (!provinceCode && !cityCode && !name && !code) {
        skipped += 1;
        continue;
      }

      try {
        if (!provinceCode) throw new BadRequestException('provinceCode 必填');
        if (!cityCode) throw new BadRequestException('cityCode 必填');
        if (!name) throw new BadRequestException('name 必填');

        const provinceId = provinceByCode.get(provinceCode);
        if (!provinceId)
          throw new BadRequestException(`省份编码不存在: ${provinceCode}`);
        const cityId = cityByProvCode.get(`${provinceId}:${cityCode}`);
        if (!cityId) throw new BadRequestException(`城市编码不存在: ${cityCode}`);

        const schoolType = cellText(
          row.getCell(headerIndex.get('schoolType') ?? 5).value,
        );
        const educationLevels = cellText(
          row.getCell(headerIndex.get('educationLevels') ?? 6).value,
        );
        const statusText = cellText(
          row.getCell(headerIndex.get('status') ?? 7).value,
        );
        const sortOrderText = cellText(
          row.getCell(headerIndex.get('sortOrder') ?? 8).value,
        );
        const remark = cellText(
          row.getCell(headerIndex.get('remark') ?? 9).value,
        );

        const status = toStatus(statusText);
        const sortOrder = toInt(sortOrderText, 0);
        const educationLevelList = educationLevels
          ? educationLevels
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean)
          : [];

        const existed = code
          ? await this.prisma.academicSchool.findFirst({
              where: { code: code.trim() },
              select: { id: true },
            })
          : await this.prisma.academicSchool.findFirst({
              where: { provinceId, cityId, name: name.trim() },
              select: { id: true },
            });

        if (existed) {
          await this.prisma.academicSchool.update({
            where: { id: existed.id },
            data: {
              provinceId,
              cityId,
              name: name.trim(),
              code: cleanCode(code),
              schoolType: cleanCode(schoolType),
              educationLevels: educationLevelList,
              status,
              sortOrder,
              remark: remark || null,
            },
          });
          updated += 1;
        } else {
          await this.prisma.academicSchool.create({
            data: {
              provinceId,
              cityId,
              name: name.trim(),
              code: cleanCode(code),
              schoolType: cleanCode(schoolType),
              educationLevels: educationLevelList,
              status,
              sortOrder,
              remark: remark || null,
            },
          });
          created += 1;
        }
      } catch (e) {
        failed += 1;
        issues.push({
          sheet: ws.name,
          row: i,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return { created, updated, skipped, failed, issues };
  }

  async importCollegesFromExcel(buffer: Buffer): Promise<ImportResult> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.getWorksheet('Colleges') ?? wb.worksheets[0];
    if (!ws) throw new BadRequestException('Excel 内容为空');

    const schools = await this.prisma.academicSchool.findMany({
      select: { id: true, code: true, name: true },
    });
    const schoolByCode = new Map(
      schools.filter((s) => s.code).map((s) => [s.code as string, s.id]),
    );
    const schoolsByName = new Map<string, string[]>();
    for (const s of schools) {
      const key = s.name.trim();
      const list = schoolsByName.get(key) ?? [];
      list.push(s.id);
      schoolsByName.set(key, list);
    }

    const headerRow = ws.getRow(1);
    const headerIndex = new Map<string, number>();
    headerRow.eachCell((cell, col) => {
      const key = cellText(cell.value).trim();
      if (key) headerIndex.set(key, col);
    });

    const issues: ImportIssue[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 2; i <= ws.rowCount; i += 1) {
      const row = ws.getRow(i);
      const schoolCode = cellText(
        row.getCell(headerIndex.get('schoolCode') ?? 1).value,
      );
      const schoolName = cellText(
        row.getCell(headerIndex.get('schoolName') ?? 2).value,
      );
      const name = cellText(row.getCell(headerIndex.get('name') ?? 3).value);
      const code = cellText(row.getCell(headerIndex.get('code') ?? 4).value);
      const hasAny = schoolCode || schoolName || name || code;
      if (!hasAny) continue;
      if (!name) {
        skipped += 1;
        continue;
      }

      try {
        let schoolId: string | undefined;
        if (schoolCode) schoolId = schoolByCode.get(schoolCode.trim());
        if (!schoolId && schoolName) {
          const ids = schoolsByName.get(schoolName.trim()) ?? [];
          if (ids.length === 1) schoolId = ids[0];
          if (ids.length > 1)
            throw new BadRequestException(
              `schoolName 匹配到多个高校，请使用 schoolCode: ${schoolName.trim()}`,
            );
        }
        if (!schoolId)
          throw new BadRequestException('未找到高校，请填写 schoolCode 或正确的 schoolName');

        const statusText = cellText(
          row.getCell(headerIndex.get('status') ?? 5).value,
        );
        const sortOrderText = cellText(
          row.getCell(headerIndex.get('sortOrder') ?? 6).value,
        );
        const remark = cellText(
          row.getCell(headerIndex.get('remark') ?? 7).value,
        );

        const status = toStatus(statusText);
        const sortOrder = toInt(sortOrderText, 0);

        const existed = await this.prisma.academicCollege.findFirst({
          where: { schoolId, name: name.trim() },
          select: { id: true },
        });

        if (existed) {
          await this.prisma.academicCollege.update({
            where: { id: existed.id },
            data: {
              schoolId,
              name: name.trim(),
              code: cleanCode(code),
              status,
              sortOrder,
              remark: remark || null,
            },
          });
          updated += 1;
        } else {
          await this.prisma.academicCollege.create({
            data: {
              schoolId,
              name: name.trim(),
              code: cleanCode(code),
              status,
              sortOrder,
              remark: remark || null,
            },
          });
          created += 1;
        }
      } catch (e) {
        failed += 1;
        issues.push({
          sheet: ws.name,
          row: i,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return { created, updated, skipped, failed, issues };
  }

  async importMajorsFromExcel(buffer: Buffer): Promise<ImportResult> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.getWorksheet('Majors') ?? wb.worksheets[0];
    if (!ws) throw new BadRequestException('Excel 内容为空');

    const [schools, colleges, categories, levelOnes, levelTwos] =
      await this.prisma.$transaction([
        this.prisma.academicSchool.findMany({
          select: { id: true, code: true, name: true },
        }),
        this.prisma.academicCollege.findMany({
          select: { id: true, schoolId: true, code: true, name: true },
        }),
        this.prisma.disciplineCategory.findMany({
          select: { id: true, code: true },
        }),
        this.prisma.disciplineLevelOne.findMany({
          select: { id: true, categoryId: true, code: true },
        }),
        this.prisma.disciplineLevelTwo.findMany({
          select: { id: true, levelOneId: true, code: true },
        }),
      ]);

    const schoolByCode = new Map(
      schools.filter((s) => s.code).map((s) => [s.code as string, s.id]),
    );
    const schoolsByName = new Map<string, string[]>();
    for (const s of schools) {
      const key = s.name.trim();
      const list = schoolsByName.get(key) ?? [];
      list.push(s.id);
      schoolsByName.set(key, list);
    }

    const collegesBySchoolIdAndCode = new Map<string, string>();
    const collegesBySchoolIdAndName = new Map<string, string>();
    for (const c of colleges) {
      if (c.code) collegesBySchoolIdAndCode.set(`${c.schoolId}:${c.code}`, c.id);
      collegesBySchoolIdAndName.set(`${c.schoolId}:${c.name.trim()}`, c.id);
    }

    const categoryByCode = new Map(categories.map((c) => [c.code, c.id]));
    const levelOneByCategoryAndCode = new Map(
      levelOnes.map((l1) => [`${l1.categoryId}:${l1.code}`, l1.id]),
    );
    const levelTwoByLevelOneAndCode = new Map(
      levelTwos.map((l2) => [`${l2.levelOneId}:${l2.code}`, l2.id]),
    );

    const headerRow = ws.getRow(1);
    const headerIndex = new Map<string, number>();
    headerRow.eachCell((cell, col) => {
      const key = cellText(cell.value).trim();
      if (key) headerIndex.set(key, col);
    });

    const issues: ImportIssue[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 2; i <= ws.rowCount; i += 1) {
      const row = ws.getRow(i);
      const schoolCode = cellText(
        row.getCell(headerIndex.get('schoolCode') ?? 1).value,
      );
      const schoolName = cellText(
        row.getCell(headerIndex.get('schoolName') ?? 2).value,
      );
      const collegeCode = cellText(
        row.getCell(headerIndex.get('collegeCode') ?? 3).value,
      );
      const collegeName = cellText(
        row.getCell(headerIndex.get('collegeName') ?? 4).value,
      );
      const name = cellText(row.getCell(headerIndex.get('name') ?? 5).value);
      const code = cellText(row.getCell(headerIndex.get('code') ?? 6).value);

      const hasAny = schoolCode || schoolName || name || code;
      if (!hasAny) continue;
      if (!name) {
        skipped += 1;
        continue;
      }

      try {
        let schoolId: string | undefined;
        if (schoolCode) schoolId = schoolByCode.get(schoolCode.trim());
        if (!schoolId && schoolName) {
          const ids = schoolsByName.get(schoolName.trim()) ?? [];
          if (ids.length === 1) schoolId = ids[0];
          if (ids.length > 1)
            throw new BadRequestException(
              `schoolName 匹配到多个高校，请使用 schoolCode: ${schoolName.trim()}`,
            );
        }
        if (!schoolId)
          throw new BadRequestException('未找到高校，请填写 schoolCode 或正确的 schoolName');

        let collegeId: string | null = null;
        if (collegeCode) {
          collegeId =
            collegesBySchoolIdAndCode.get(`${schoolId}:${collegeCode.trim()}`) ??
            null;
          if (!collegeId)
            throw new BadRequestException(`未找到学院编码: ${collegeCode.trim()}`);
        } else if (collegeName) {
          collegeId =
            collegesBySchoolIdAndName.get(`${schoolId}:${collegeName.trim()}`) ??
            null;
          if (!collegeId)
            throw new BadRequestException(`未找到学院名称: ${collegeName.trim()}`);
        }

        const educationLevelText = cellText(
          row.getCell(headerIndex.get('educationLevel') ?? 7).value,
        );
        const disciplineCategoryCode = cellText(
          row.getCell(headerIndex.get('disciplineCategoryCode') ?? 8).value,
        );
        const disciplineLevelOneCode = cellText(
          row.getCell(headerIndex.get('disciplineLevelOneCode') ?? 9).value,
        );
        const disciplineLevelTwoCode = cellText(
          row.getCell(headerIndex.get('disciplineLevelTwoCode') ?? 10).value,
        );
        const statusText = cellText(
          row.getCell(headerIndex.get('status') ?? 11).value,
        );
        const sortOrderText = cellText(
          row.getCell(headerIndex.get('sortOrder') ?? 12).value,
        );
        const remark = cellText(
          row.getCell(headerIndex.get('remark') ?? 13).value,
        );

        const status = toStatus(statusText);
        const sortOrder = toInt(sortOrderText, 0);
        const educationLevel = cleanCode(educationLevelText);

        const categoryId = disciplineCategoryCode
          ? categoryByCode.get(disciplineCategoryCode.trim()) ?? null
          : null;
        if (disciplineCategoryCode && !categoryId)
          throw new BadRequestException(
            `学科门类编码不存在: ${disciplineCategoryCode.trim()}`,
          );
        const levelOneId =
          categoryId && disciplineLevelOneCode
            ? levelOneByCategoryAndCode.get(
                `${categoryId}:${disciplineLevelOneCode.trim()}`,
              ) ?? null
            : null;
        if (categoryId && disciplineLevelOneCode && !levelOneId)
          throw new BadRequestException(
            `一级学科编码不存在: ${disciplineLevelOneCode.trim()}`,
          );
        const levelTwoId =
          levelOneId && disciplineLevelTwoCode
            ? levelTwoByLevelOneAndCode.get(
                `${levelOneId}:${disciplineLevelTwoCode.trim()}`,
              ) ?? null
            : null;
        if (levelOneId && disciplineLevelTwoCode && !levelTwoId)
          throw new BadRequestException(
            `二级学科编码不存在: ${disciplineLevelTwoCode.trim()}`,
          );

        const existed = await this.prisma.academicMajor.findFirst({
          where: {
            schoolId,
            collegeId,
            name: name.trim(),
            educationLevel,
          },
          select: { id: true },
        });

        if (existed) {
          await this.prisma.academicMajor.update({
            where: { id: existed.id },
            data: {
              schoolId,
              collegeId,
              disciplineCategoryId: categoryId,
              disciplineLevelOneId: levelOneId,
              disciplineLevelTwoId: levelTwoId,
              name: name.trim(),
              code: cleanCode(code),
              educationLevel,
              status,
              sortOrder,
              remark: remark || null,
            },
          });
          updated += 1;
        } else {
          await this.prisma.academicMajor.create({
            data: {
              schoolId,
              collegeId,
              disciplineCategoryId: categoryId,
              disciplineLevelOneId: levelOneId,
              disciplineLevelTwoId: levelTwoId,
              name: name.trim(),
              code: cleanCode(code),
              educationLevel,
              status,
              sortOrder,
              remark: remark || null,
            },
          });
          created += 1;
        }
      } catch (e) {
        failed += 1;
        issues.push({
          sheet: ws.name,
          row: i,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return { created, updated, skipped, failed, issues };
  }

  async importDisciplinesFromExcel(buffer: Buffer): Promise<ImportResult> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const issues: ImportIssue[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    const categoriesSheet = wb.getWorksheet('Categories');
    const levelOnesSheet = wb.getWorksheet('LevelOnes');
    const levelTwosSheet = wb.getWorksheet('LevelTwos');

    const categories = await this.prisma.disciplineCategory.findMany({
      select: { id: true, code: true },
    });
    const categoryByCode = new Map(categories.map((c) => [c.code, c.id]));

    if (categoriesSheet) {
      for (let i = 2; i <= categoriesSheet.rowCount; i += 1) {
        const row = categoriesSheet.getRow(i);
        const code = cellText(row.getCell(1).value);
        const name = cellText(row.getCell(2).value);
        const statusText = cellText(row.getCell(3).value);
        const sortOrderText = cellText(row.getCell(4).value);
        if (!code && !name) continue;
        if (!code || !name) {
          skipped += 1;
          continue;
        }
        try {
          const status = toStatus(statusText);
          const sortOrder = toInt(sortOrderText, 0);
          const existed = await this.prisma.disciplineCategory.findUnique({
            where: { code: code.trim() },
            select: { id: true },
          });
          if (existed) {
            await this.prisma.disciplineCategory.update({
              where: { id: existed.id },
              data: { name: name.trim(), status, sortOrder },
            });
            updated += 1;
          } else {
            const item = await this.prisma.disciplineCategory.create({
              data: { code: code.trim(), name: name.trim(), status, sortOrder },
            });
            categoryByCode.set(item.code, item.id);
            created += 1;
          }
        } catch (e) {
          failed += 1;
          issues.push({
            sheet: categoriesSheet.name,
            row: i,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    const levelOnes = await this.prisma.disciplineLevelOne.findMany({
      select: { id: true, categoryId: true, code: true },
    });
    const levelOneByCategoryAndCode = new Map(
      levelOnes.map((l1) => [`${l1.categoryId}:${l1.code}`, l1.id]),
    );

    if (levelOnesSheet) {
      for (let i = 2; i <= levelOnesSheet.rowCount; i += 1) {
        const row = levelOnesSheet.getRow(i);
        const categoryCode = cellText(row.getCell(1).value);
        const code = cellText(row.getCell(2).value);
        const name = cellText(row.getCell(3).value);
        const statusText = cellText(row.getCell(4).value);
        const sortOrderText = cellText(row.getCell(5).value);
        if (!categoryCode && !code && !name) continue;
        if (!categoryCode || !code || !name) {
          skipped += 1;
          continue;
        }
        try {
          const categoryId = categoryByCode.get(categoryCode.trim());
          if (!categoryId)
            throw new BadRequestException(
              `学科门类编码不存在: ${categoryCode.trim()}`,
            );
          const status = toStatus(statusText);
          const sortOrder = toInt(sortOrderText, 0);
          const existed = await this.prisma.disciplineLevelOne.findFirst({
            where: { categoryId, code: code.trim() },
            select: { id: true },
          });
          if (existed) {
            await this.prisma.disciplineLevelOne.update({
              where: { id: existed.id },
              data: { name: name.trim(), status, sortOrder },
            });
            levelOneByCategoryAndCode.set(`${categoryId}:${code.trim()}`, existed.id);
            updated += 1;
          } else {
            const item = await this.prisma.disciplineLevelOne.create({
              data: {
                categoryId,
                code: code.trim(),
                name: name.trim(),
                status,
                sortOrder,
              },
            });
            levelOneByCategoryAndCode.set(`${categoryId}:${item.code}`, item.id);
            created += 1;
          }
        } catch (e) {
          failed += 1;
          issues.push({
            sheet: levelOnesSheet.name,
            row: i,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    const levelTwos = await this.prisma.disciplineLevelTwo.findMany({
      select: { id: true, levelOneId: true, code: true },
    });
    const levelTwoByLevelOneAndCode = new Map(
      levelTwos.map((l2) => [`${l2.levelOneId}:${l2.code}`, l2.id]),
    );

    if (levelTwosSheet) {
      for (let i = 2; i <= levelTwosSheet.rowCount; i += 1) {
        const row = levelTwosSheet.getRow(i);
        const categoryCode = cellText(row.getCell(1).value);
        const levelOneCode = cellText(row.getCell(2).value);
        const code = cellText(row.getCell(3).value);
        const name = cellText(row.getCell(4).value);
        const statusText = cellText(row.getCell(5).value);
        const sortOrderText = cellText(row.getCell(6).value);
        if (!categoryCode && !levelOneCode && !code && !name) continue;
        if (!categoryCode || !levelOneCode || !code || !name) {
          skipped += 1;
          continue;
        }
        try {
          const categoryId = categoryByCode.get(categoryCode.trim());
          if (!categoryId)
            throw new BadRequestException(
              `学科门类编码不存在: ${categoryCode.trim()}`,
            );
          const levelOneId = levelOneByCategoryAndCode.get(
            `${categoryId}:${levelOneCode.trim()}`,
          );
          if (!levelOneId)
            throw new BadRequestException(
              `一级学科编码不存在: ${levelOneCode.trim()}`,
            );
          const status = toStatus(statusText);
          const sortOrder = toInt(sortOrderText, 0);
          const existedId =
            levelTwoByLevelOneAndCode.get(`${levelOneId}:${code.trim()}`) ??
            null;
          if (existedId) {
            await this.prisma.disciplineLevelTwo.update({
              where: { id: existedId },
              data: { name: name.trim(), status, sortOrder },
            });
            updated += 1;
          } else {
            const item = await this.prisma.disciplineLevelTwo.create({
              data: {
                levelOneId,
                code: code.trim(),
                name: name.trim(),
                status,
                sortOrder,
              },
            });
            levelTwoByLevelOneAndCode.set(`${levelOneId}:${item.code}`, item.id);
            created += 1;
          }
        } catch (e) {
          failed += 1;
          issues.push({
            sheet: levelTwosSheet.name,
            row: i,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    return { created, updated, skipped, failed, issues };
  }

  private majorCreateData(
    dto: CreateMajorDto,
  ): Prisma.AcademicMajorUncheckedCreateInput {
    return {
      schoolId: dto.schoolId,
      collegeId: dto.collegeId || null,
      disciplineCategoryId: dto.disciplineCategoryId || null,
      disciplineLevelOneId: dto.disciplineLevelOneId || null,
      disciplineLevelTwoId: dto.disciplineLevelTwoId || null,
      name: dto.name.trim(),
      code: cleanCode(dto.code),
      educationLevel: cleanCode(dto.educationLevel),
      status: dto.status ?? AcademicStatus.ACTIVE,
      sortOrder: dto.sortOrder ?? 0,
      remark: dto.remark ?? null,
    };
  }

  private majorUpdateData(
    dto: UpdateMajorDto,
  ): Prisma.AcademicMajorUncheckedUpdateInput {
    return {
      schoolId: dto.schoolId ?? undefined,
      collegeId:
        dto.collegeId === undefined ? undefined : dto.collegeId || null,
      disciplineCategoryId:
        dto.disciplineCategoryId === undefined
          ? undefined
          : dto.disciplineCategoryId || null,
      disciplineLevelOneId:
        dto.disciplineLevelOneId === undefined
          ? undefined
          : dto.disciplineLevelOneId || null,
      disciplineLevelTwoId:
        dto.disciplineLevelTwoId === undefined
          ? undefined
          : dto.disciplineLevelTwoId || null,
      name: dto.name?.trim() ?? undefined,
      code: dto.code === undefined ? undefined : cleanCode(dto.code),
      educationLevel:
        dto.educationLevel === undefined
          ? undefined
          : cleanCode(dto.educationLevel),
      status: dto.status ?? undefined,
      sortOrder: dto.sortOrder ?? undefined,
      remark: dto.remark ?? undefined,
    };
  }

  private async ensureSchool(id: string) {
    const found = await this.prisma.academicSchool.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('高校不存在');
  }

  private async ensureCollege(id: string) {
    const found = await this.prisma.academicCollege.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('学院不存在');
  }

  private async ensureMajor(id: string) {
    const found = await this.prisma.academicMajor.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('专业不存在');
  }

  private async ensureCategory(id: string) {
    const found = await this.prisma.disciplineCategory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('学科门类不存在');
  }

  private async ensureLevelOne(id: string) {
    const found = await this.prisma.disciplineLevelOne.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('一级学科不存在');
  }

  private async ensureLevelTwo(id: string) {
    const found = await this.prisma.disciplineLevelTwo.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('二级学科不存在');
  }
}
