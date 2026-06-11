import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ThesisSkillRunStatus,
  ThesisSkillStage,
  ThesisSkillStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateThesisSkillBindingDto,
  CreateThesisSkillDto,
  CreateThesisSkillVersionDto,
  ListThesisSkillRunsDto,
  ListThesisSkillsDto,
  TestRunThesisSkillDto,
  UpdateThesisSkillBindingDto,
  UpdateThesisSkillDto,
  UpdateThesisSkillVersionDto,
} from './dto/thesis-skill.dto';
import { ThesisSkillRunnerService } from './thesis-skill-runner.service';

const MAX_PAGE_SIZE = 100;

type PageInput = { page?: number; pageSize?: number };
type ResolveBestSkillInput = {
  stage: ThesisSkillStage;
  educationLevel?: string;
  thesisType?: string;
  schoolId?: string;
  majorId?: string;
  disciplineCategoryId?: string;
  disciplineLevelOneId?: string;
  disciplineLevelTwoId?: string;
};

function pageArgs(q: PageInput) {
  const page = Math.max(1, Number(q.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(q.pageSize ?? 20)),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function nullable(value?: string) {
  const s = value?.trim();
  return s ? s : null;
}

function toJsonObject(value: Record<string, unknown> | undefined) {
  return (value ?? {}) as Prisma.InputJsonObject;
}

@Injectable()
export class ThesisSkillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: ThesisSkillRunnerService,
  ) {}

  async listSkills(q: ListThesisSkillsDto) {
    const { page, pageSize, skip, take } = pageArgs(q);
    const where: Prisma.ThesisSkillWhereInput = {};
    if (q.stage) where.stage = q.stage;
    if (q.status) where.status = q.status;
    if (q.keyword?.trim()) {
      const keyword = q.keyword.trim();
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
      ];
    }
    const [total, list] = await this.prisma.$transaction([
      this.prisma.thesisSkill.count({ where }),
      this.prisma.thesisSkill.findMany({
        where,
        include: { versions: { where: { isActive: true }, take: 1 } },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take,
      }),
    ]);
    return { list, total, page, pageSize };
  }

  async getSkillDetail(id: string) {
    const skill = await this.prisma.thesisSkill.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: 'desc' } },
        bindings: { orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }] },
      },
    });
    if (!skill) throw new NotFoundException('Skill 不存在');
    return skill;
  }

  async createSkill(dto: CreateThesisSkillDto) {
    try {
      return await this.prisma.thesisSkill.create({
        data: {
          name: dto.name.trim(),
          code: dto.code.trim(),
          description: dto.description ?? null,
          stage: dto.stage,
          category: dto.category,
          status: dto.status ?? ThesisSkillStatus.ENABLED,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (e) {
      this.handleUniqueError(e);
    }
  }

  async updateSkill(id: string, dto: UpdateThesisSkillDto) {
    await this.ensureSkill(id);
    try {
      return await this.prisma.thesisSkill.update({
        where: { id },
        data: {
          name: dto.name?.trim() ?? undefined,
          code: dto.code?.trim() ?? undefined,
          description: dto.description ?? undefined,
          stage: dto.stage ?? undefined,
          category: dto.category ?? undefined,
          status: dto.status ?? undefined,
          sortOrder: dto.sortOrder ?? undefined,
        },
      });
    } catch (e) {
      this.handleUniqueError(e);
    }
  }

  async disableSkill(id: string) {
    await this.ensureSkill(id);
    return this.prisma.thesisSkill.update({
      where: { id },
      data: { status: ThesisSkillStatus.DISABLED },
    });
  }

  async listVersions(skillId: string) {
    await this.ensureSkill(skillId);
    return this.prisma.thesisSkillVersion.findMany({
      where: { skillId },
      orderBy: { version: 'desc' },
    });
  }

  async getVersionDetail(versionId: string) {
    const version = await this.prisma.thesisSkillVersion.findUnique({
      where: { id: versionId },
      include: { skill: true },
    });
    if (!version) throw new NotFoundException('Skill 版本不存在');
    return version;
  }

  async createSkillVersion(skillId: string, dto: CreateThesisSkillVersionDto) {
    await this.ensureSkill(skillId);
    const version = dto.version ?? (await this.nextVersion(skillId));
    const created = await this.prisma.thesisSkillVersion.create({
      data: {
        skillId,
        version,
        promptTemplate: dto.promptTemplate,
        inputSchema: toJsonObject(dto.inputSchema),
        outputSchema: toJsonObject(dto.outputSchema),
        qualityRules: toJsonObject(dto.qualityRules),
        modelConfig: toJsonObject(dto.modelConfig),
        changeLog: dto.changeLog ?? null,
      },
    });
    if (dto.isActive) return this.activateSkillVersion(created.id);
    return created;
  }

  async updateSkillVersion(
    versionId: string,
    dto: UpdateThesisSkillVersionDto,
  ) {
    await this.ensureVersion(versionId);
    const updated = await this.prisma.thesisSkillVersion.update({
      where: { id: versionId },
      data: {
        version: dto.version ?? undefined,
        promptTemplate: dto.promptTemplate ?? undefined,
        inputSchema:
          dto.inputSchema === undefined
            ? undefined
            : toJsonObject(dto.inputSchema),
        outputSchema:
          dto.outputSchema === undefined
            ? undefined
            : toJsonObject(dto.outputSchema),
        qualityRules:
          dto.qualityRules === undefined
            ? undefined
            : toJsonObject(dto.qualityRules),
        modelConfig:
          dto.modelConfig === undefined
            ? undefined
            : toJsonObject(dto.modelConfig),
        changeLog: dto.changeLog ?? undefined,
      },
    });
    if (dto.isActive) return this.activateSkillVersion(updated.id);
    return updated;
  }

  async activateSkillVersion(versionId: string) {
    const version = await this.ensureVersion(versionId);
    return this.prisma.$transaction(async (tx) => {
      await tx.thesisSkillVersion.updateMany({
        where: { skillId: version.skillId },
        data: { isActive: false, activeKey: null },
      });
      return tx.thesisSkillVersion.update({
        where: { id: versionId },
        data: { isActive: true, activeKey: version.skillId },
      });
    });
  }

  async listBindings(skillId: string) {
    await this.ensureSkill(skillId);
    return this.prisma.thesisSkillBinding.findMany({
      where: { skillId },
      include: {
        skillVersion: true,
        school: true,
        major: true,
        disciplineCategory: true,
        disciplineLevelOne: true,
        disciplineLevelTwo: true,
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async createSkillBinding(skillId: string, dto: CreateThesisSkillBindingDto) {
    await this.ensureSkill(skillId);
    return this.prisma.thesisSkillBinding.create({
      data: this.bindingData(skillId, dto),
    });
  }

  async updateSkillBinding(
    bindingId: string,
    dto: UpdateThesisSkillBindingDto,
  ) {
    await this.ensureBinding(bindingId);
    return this.prisma.thesisSkillBinding.update({
      where: { id: bindingId },
      data: this.bindingUpdateData(dto),
    });
  }

  async disableSkillBinding(bindingId: string) {
    await this.ensureBinding(bindingId);
    return this.prisma.thesisSkillBinding.update({
      where: { id: bindingId },
      data: { status: ThesisSkillStatus.DISABLED },
    });
  }

  async listSkillRuns(q: ListThesisSkillRunsDto) {
    const { page, pageSize, skip, take } = pageArgs(q);
    const where: Prisma.ThesisSkillRunWhereInput = {};
    if (q.skillId) where.skillId = q.skillId;
    if (q.stage) where.stage = q.stage;
    if (q.status) where.status = q.status;
    const [total, list] = await this.prisma.$transaction([
      this.prisma.thesisSkillRun.count({ where }),
      this.prisma.thesisSkillRun.findMany({
        where,
        include: { skill: true, skillVersion: true, binding: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { list, total, page, pageSize };
  }

  async getSkillRunDetail(id: string) {
    const run = await this.prisma.thesisSkillRun.findUnique({
      where: { id },
      include: { skill: true, skillVersion: true, binding: true, task: true },
    });
    if (!run) throw new NotFoundException('Skill 运行记录不存在');
    return run;
  }

  async testRunSkill(skillId: string, dto: TestRunThesisSkillDto) {
    const skill = await this.ensureSkill(skillId);
    const resolved = await this.resolveBestSkill(
      {
        stage: dto.stage ?? skill.stage,
        educationLevel: dto.educationLevel,
        thesisType: dto.thesisType,
        schoolId: dto.schoolId,
        majorId: dto.majorId,
        disciplineCategoryId: dto.disciplineCategoryId,
        disciplineLevelOneId: dto.disciplineLevelOneId,
        disciplineLevelTwoId: dto.disciplineLevelTwoId,
      },
      skillId,
    );
    if (!resolved) throw new BadRequestException('当前阶段没有可用 Skill 版本');

    const inputPayload = {
      stage: resolved.skill.stage,
      ...(dto.inputPayload ?? {}),
      educationLevel:
        dto.educationLevel ?? dto.inputPayload?.educationLevel ?? '',
      thesisType: dto.thesisType ?? dto.inputPayload?.thesisType ?? '',
    } as Record<string, unknown>;

    const startedAt = new Date();
    const preview = this.runner.preview(resolved.version, inputPayload);
    return this.prisma.thesisSkillRun.create({
      data: {
        skillId: resolved.skill.id,
        skillVersionId: resolved.version.id,
        bindingId: resolved.binding?.id ?? null,
        stage: resolved.skill.stage,
        inputPayload: inputPayload as Prisma.InputJsonObject,
        outputPayload: preview.outputPayload as Prisma.InputJsonObject,
        qualityResult: preview.qualityResult,
        modelName: preview.modelName,
        tokenUsage: preview.tokenUsage,
        status: ThesisSkillRunStatus.SUCCESS,
        startedAt,
        finishedAt: new Date(),
      },
      include: { skill: true, skillVersion: true, binding: true },
    });
  }

  async resolveBestSkill(input: ResolveBestSkillInput, forceSkillId?: string) {
    const where: Prisma.ThesisSkillBindingWhereInput = {
      status: ThesisSkillStatus.ENABLED,
      skill: {
        stage: input.stage,
        status: ThesisSkillStatus.ENABLED,
        ...(forceSkillId ? { id: forceSkillId } : {}),
      },
      AND: [
        this.nullOrEquals('educationLevel', input.educationLevel),
        this.nullOrEquals('thesisType', input.thesisType),
        this.nullOrEquals('schoolId', input.schoolId),
        this.nullOrEquals('majorId', input.majorId),
        this.nullOrEquals('disciplineCategoryId', input.disciplineCategoryId),
        this.nullOrEquals('disciplineLevelOneId', input.disciplineLevelOneId),
        this.nullOrEquals('disciplineLevelTwoId', input.disciplineLevelTwoId),
      ],
    };
    const bindings = await this.prisma.thesisSkillBinding.findMany({
      where,
      include: {
        skill: true,
        skillVersion: true,
      },
    });
    const sorted = bindings
      .map((binding) => ({ binding, score: this.scoreBinding(binding, input) }))
      .sort(
        (a, b) => b.score - a.score || b.binding.priority - a.binding.priority,
      );

    for (const candidate of sorted) {
      const version =
        candidate.binding.skillVersion ??
        (await this.getActiveVersion(candidate.binding.skillId));
      if (version)
        return {
          skill: candidate.binding.skill,
          version,
          binding: candidate.binding,
        };
    }

    const fallbackSkill = await this.prisma.thesisSkill.findFirst({
      where: {
        stage: input.stage,
        status: ThesisSkillStatus.ENABLED,
        ...(forceSkillId ? { id: forceSkillId } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
    if (!fallbackSkill) return null;
    const version = await this.getActiveVersion(fallbackSkill.id);
    if (!version) return null;
    return { skill: fallbackSkill, version, binding: null };
  }

  private nullOrEquals(
    field: string,
    value?: string,
  ): Prisma.ThesisSkillBindingWhereInput {
    if (!value) return { [field]: null };
    return {
      OR: [{ [field]: value }, { [field]: null }],
    };
  }

  private scoreBinding(
    binding: { priority: number } & Record<string, unknown>,
    input: ResolveBestSkillInput,
  ) {
    const fields: Array<keyof ResolveBestSkillInput> = [
      'schoolId',
      'majorId',
      'disciplineLevelTwoId',
      'disciplineLevelOneId',
      'disciplineCategoryId',
      'educationLevel',
      'thesisType',
    ];
    const specificity = fields.reduce(
      (score, field) =>
        score + (input[field] && binding[field] === input[field] ? 10 : 0),
      0,
    );
    return specificity + binding.priority;
  }

  private async getActiveVersion(skillId: string) {
    return this.prisma.thesisSkillVersion.findFirst({
      where: { skillId, isActive: true },
    });
  }

  private bindingData(
    skillId: string,
    dto: CreateThesisSkillBindingDto,
  ): Prisma.ThesisSkillBindingUncheckedCreateInput {
    return {
      skillId,
      skillVersionId: nullable(dto.skillVersionId),
      educationLevel: nullable(dto.educationLevel),
      thesisType: nullable(dto.thesisType),
      disciplineCategoryId: nullable(dto.disciplineCategoryId),
      disciplineLevelOneId: nullable(dto.disciplineLevelOneId),
      disciplineLevelTwoId: nullable(dto.disciplineLevelTwoId),
      schoolId: nullable(dto.schoolId),
      majorId: nullable(dto.majorId),
      priority: dto.priority ?? 0,
      status: dto.status ?? ThesisSkillStatus.ENABLED,
    };
  }

  private bindingUpdateData(
    dto: UpdateThesisSkillBindingDto,
  ): Prisma.ThesisSkillBindingUncheckedUpdateInput {
    return {
      skillVersionId:
        dto.skillVersionId === undefined
          ? undefined
          : nullable(dto.skillVersionId),
      educationLevel:
        dto.educationLevel === undefined
          ? undefined
          : nullable(dto.educationLevel),
      thesisType:
        dto.thesisType === undefined ? undefined : nullable(dto.thesisType),
      disciplineCategoryId:
        dto.disciplineCategoryId === undefined
          ? undefined
          : nullable(dto.disciplineCategoryId),
      disciplineLevelOneId:
        dto.disciplineLevelOneId === undefined
          ? undefined
          : nullable(dto.disciplineLevelOneId),
      disciplineLevelTwoId:
        dto.disciplineLevelTwoId === undefined
          ? undefined
          : nullable(dto.disciplineLevelTwoId),
      schoolId: dto.schoolId === undefined ? undefined : nullable(dto.schoolId),
      majorId: dto.majorId === undefined ? undefined : nullable(dto.majorId),
      priority: dto.priority ?? undefined,
      status: dto.status ?? undefined,
    };
  }

  private async ensureSkill(id: string) {
    const skill = await this.prisma.thesisSkill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException('Skill 不存在');
    return skill;
  }

  private async ensureVersion(id: string) {
    const version = await this.prisma.thesisSkillVersion.findUnique({
      where: { id },
    });
    if (!version) throw new NotFoundException('Skill 版本不存在');
    return version;
  }

  private async ensureBinding(id: string) {
    const binding = await this.prisma.thesisSkillBinding.findUnique({
      where: { id },
    });
    if (!binding) throw new NotFoundException('Skill 绑定不存在');
    return binding;
  }

  private async nextVersion(skillId: string) {
    const last = await this.prisma.thesisSkillVersion.findFirst({
      where: { skillId },
      orderBy: { version: 'desc' },
    });
    return (last?.version ?? 0) + 1;
  }

  private handleUniqueError(e: unknown): never {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      throw new BadRequestException('Skill 编码或版本已存在');
    }
    throw e;
  }
}
