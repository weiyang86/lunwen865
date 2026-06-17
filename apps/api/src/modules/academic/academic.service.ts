import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcademicStatus, Prisma } from '@prisma/client';
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
    if (q.provinceCode) where.provinceCode = q.provinceCode;
    if (q.cityCode) where.cityCode = q.cityCode;
    if (q.schoolType) where.schoolType = q.schoolType;
    if (q.educationLevel) where.educationLevels = { has: q.educationLevel };
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
