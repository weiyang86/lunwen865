import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ThesisFormatTemplateStatus,
  ThesisFormatTemplateType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateThesisFormatRuleDto,
  CreateThesisFormatTemplateDto,
  ListThesisFormatTemplatesDto,
  UpdateThesisDocumentFormatSettingDto,
  UpdateThesisFormatRuleDto,
  UpdateThesisFormatTemplateDto,
} from './dto/thesis-format-template.dto';

const GENERAL_TEMPLATE_CODE = 'global-undergraduate-full-paper';
type Actor = { id: string; role?: string | null; admin?: boolean };

@Injectable()
export class ThesisExportTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: ListThesisFormatTemplatesDto) {
    const page = Math.max(1, dto.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, dto.pageSize ?? 20));
    const where: Prisma.ThesisFormatTemplateWhereInput = {};
    if (dto.keyword) {
      where.OR = [
        { name: { contains: dto.keyword, mode: 'insensitive' } },
        { code: { contains: dto.keyword, mode: 'insensitive' } },
      ];
    }
    if (dto.schoolId) where.schoolId = dto.schoolId;
    if (dto.collegeId) where.collegeId = dto.collegeId;
    if (dto.majorId) where.majorId = dto.majorId;
    if (dto.educationLevel) where.educationLevel = dto.educationLevel;
    if (dto.thesisType) where.thesisType = dto.thesisType;
    if (dto.stage) where.stage = dto.stage;
    if (dto.status) where.status = dto.status;
    if (dto.templateType) where.templateType = dto.templateType;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.thesisFormatTemplate.findMany({
        where,
        orderBy: [
          { isDefault: 'desc' },
          { sortOrder: 'asc' },
          { updatedAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.includeScope(),
      }),
      this.prisma.thesisFormatTemplate.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async create(dto: CreateThesisFormatTemplateDto) {
    await this.validateScope(dto);
    return this.prisma.thesisFormatTemplate.create({
      data: {
        name: dto.name.trim(),
        code: dto.code.trim(),
        description: dto.description,
        schoolId: dto.schoolId || null,
        collegeId: dto.collegeId || null,
        majorId: dto.majorId || null,
        educationLevel: dto.educationLevel || null,
        thesisType: dto.thesisType || null,
        stage: dto.stage || null,
        templateType: dto.templateType ?? this.inferTemplateType(dto),
        isDefault: dto.isDefault ?? false,
        status: dto.status ?? ThesisFormatTemplateStatus.ENABLED,
        version: dto.version ?? 1,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async get(id: string) {
    const item = await this.prisma.thesisFormatTemplate.findUnique({
      where: { id },
      include: {
        ...this.includeScope(),
        rules: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!item) throw new NotFoundException('格式模板不存在');
    return item;
  }

  async update(id: string, dto: UpdateThesisFormatTemplateDto) {
    await this.get(id);
    await this.validateScope(dto);
    return this.prisma.thesisFormatTemplate.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code?.trim(),
        description: dto.description,
        schoolId: dto.schoolId === undefined ? undefined : dto.schoolId || null,
        collegeId:
          dto.collegeId === undefined ? undefined : dto.collegeId || null,
        majorId: dto.majorId === undefined ? undefined : dto.majorId || null,
        educationLevel:
          dto.educationLevel === undefined
            ? undefined
            : dto.educationLevel || null,
        thesisType:
          dto.thesisType === undefined ? undefined : dto.thesisType || null,
        stage: dto.stage === undefined ? undefined : dto.stage || null,
        templateType: dto.templateType,
        isDefault: dto.isDefault,
        status: dto.status,
        version: dto.version,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async disable(id: string) {
    await this.get(id);
    return this.prisma.thesisFormatTemplate.update({
      where: { id },
      data: { status: ThesisFormatTemplateStatus.DISABLED },
    });
  }

  async listRules(templateId: string) {
    await this.get(templateId);
    return this.prisma.thesisFormatRule.findMany({
      where: { templateId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createRule(templateId: string, dto: CreateThesisFormatRuleDto) {
    await this.get(templateId);
    return this.prisma.thesisFormatRule.create({
      data: {
        templateId,
        ruleType: dto.ruleType,
        ruleKey: dto.ruleKey.trim(),
        ruleValue: this.toJson(dto.ruleValue),
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateRule(ruleId: string, dto: UpdateThesisFormatRuleDto) {
    const rule = await this.prisma.thesisFormatRule.findUnique({
      where: { id: ruleId },
    });
    if (!rule) throw new NotFoundException('格式规则不存在');
    return this.prisma.thesisFormatRule.update({
      where: { id: ruleId },
      data: {
        ruleType: dto.ruleType,
        ruleKey: dto.ruleKey?.trim(),
        ruleValue:
          dto.ruleValue === undefined ? undefined : this.toJson(dto.ruleValue),
        description: dto.description,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async deleteRule(ruleId: string) {
    const rule = await this.prisma.thesisFormatRule.findUnique({
      where: { id: ruleId },
    });
    if (!rule) throw new NotFoundException('格式规则不存在');
    await this.prisma.thesisFormatRule.delete({ where: { id: ruleId } });
    return { success: true };
  }

  async resolveExportTemplatesForTask(
    taskId: string,
    options?: { stage?: string; exportFormat?: string },
  ) {
    void options?.exportFormat;
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('任务不存在');
    const effectiveStage =
      options?.stage ?? task.thesisType ?? task.currentStage ?? undefined;
    const templates = await this.prisma.thesisFormatTemplate.findMany({
      where: {
        status: ThesisFormatTemplateStatus.ENABLED,
        AND: [
          { OR: [{ schoolId: null }, { schoolId: task.academicSchoolId }] },
          { OR: [{ collegeId: null }, { collegeId: task.collegeId }] },
          { OR: [{ majorId: null }, { majorId: task.majorId }] },
          {
            OR: [
              { educationLevel: null },
              { educationLevel: task.educationLevel },
            ],
          },
          { OR: [{ thesisType: null }, { thesisType: task.thesisType }] },
          { OR: [{ stage: null }, { stage: effectiveStage ?? null }] },
        ],
      },
      include: this.includeScope(),
    });
    let ranked = templates
      .map((template) => ({
        template,
        score: this.scoreTemplate(template, task, effectiveStage),
      }))
      .filter((x) => x.score >= 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          Number(b.template.isDefault) - Number(a.template.isDefault) ||
          a.template.sortOrder - b.template.sortOrder ||
          b.template.version - a.template.version,
      )
      .map((x) => x.template);

    if (!ranked.length) {
      const fallback = await this.prisma.thesisFormatTemplate.findFirst({
        where: {
          code: GENERAL_TEMPLATE_CODE,
          status: ThesisFormatTemplateStatus.ENABLED,
        },
        include: this.includeScope(),
      });
      if (fallback) ranked = [fallback];
    }
    return ranked;
  }

  async getTaskFormatTemplates(
    taskId: string,
    options: { stage?: string } | undefined,
    actor: Actor,
  ) {
    await this.assertTaskAccess(taskId, actor);
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        academicSchool: { select: { id: true, name: true } },
        college: { select: { id: true, name: true } },
        academicMajor: { select: { id: true, name: true } },
        thesisDocument: {
          select: { id: true, title: true, formatSetting: true },
        },
      },
    });
    if (!task) throw new NotFoundException('任务不存在');
    const matchedTemplates = await this.resolveExportTemplatesForTask(taskId, {
      stage: options?.stage,
    });
    const currentSetting = task.thesisDocument
      ? await this.prisma.thesisDocumentFormatSetting.findUnique({
          where: { documentId: task.thesisDocument.id },
          include: {
            template: {
              include: {
                ...this.includeScope(),
                rules: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                },
              },
            },
          },
        })
      : null;
    const warnings: string[] = [];
    if (!task.thesisDocument)
      warnings.push('请先初始化合稿与格式中的论文文档，再保存格式配置');
    if (!matchedTemplates.length)
      warnings.push('暂无可用模板，请联系管理员配置全局通用模板');
    return {
      matchedTemplates: await this.withRuleSummaries(matchedTemplates),
      defaultTemplate: matchedTemplates[0]
        ? await this.withRuleSummary(matchedTemplates[0].id)
        : null,
      currentSetting,
      taskContext: {
        id: task.id,
        title: task.title,
        schoolId: task.academicSchoolId,
        schoolName: task.academicSchool?.name ?? null,
        collegeId: task.collegeId,
        collegeName: task.college?.name ?? null,
        majorId: task.majorId,
        majorName: task.academicMajor?.name ?? task.major,
        educationLevel: task.educationLevel,
        thesisType: task.thesisType,
        stage: options?.stage ?? null,
      },
      warningMessages: warnings,
    };
  }

  async getDocumentFormatSetting(documentId: string, actor: Actor) {
    const document = await this.assertDocumentAccess(documentId, actor);
    const setting = await this.prisma.thesisDocumentFormatSetting.findUnique({
      where: { documentId },
      include: {
        template: {
          include: {
            ...this.includeScope(),
            rules: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
          },
        },
      },
    });
    const templates = await this.resolveExportTemplatesForTask(
      document.taskId,
      {
        stage: document.task.currentStage ?? undefined,
      },
    );
    return {
      currentSetting: setting,
      defaultTemplate: templates[0]
        ? await this.withRuleSummary(templates[0].id)
        : null,
      rulesSummary: setting?.templateId
        ? await this.getRulesSummary(setting.templateId)
        : [],
      warningMessages: templates.length
        ? []
        : ['暂无可用模板，请联系管理员配置全局通用模板'],
    };
  }

  async saveDocumentFormatSetting(
    documentId: string,
    dto: UpdateThesisDocumentFormatSettingDto,
    actor: Actor,
  ) {
    await this.assertDocumentAccess(documentId, actor);
    if (dto.templateId) await this.assertEnabledTemplate(dto.templateId);
    const data: Prisma.ThesisDocumentFormatSettingUpdateInput = {
      template:
        dto.templateId === undefined
          ? undefined
          : dto.templateId
            ? { connect: { id: dto.templateId } }
            : { disconnect: true },
      overrideRules:
        dto.overrideRules === undefined
          ? undefined
          : this.toJson(dto.overrideRules),
      customRequirement:
        dto.customRequirement === undefined
          ? undefined
          : dto.customRequirement.trim(),
      previewMode:
        dto.previewMode === undefined ? undefined : dto.previewMode || 'SIMPLE',
    };
    const setting = await this.prisma.thesisDocumentFormatSetting.upsert({
      where: { documentId },
      update: data,
      create: {
        document: { connect: { id: documentId } },
        template: dto.templateId
          ? { connect: { id: dto.templateId } }
          : undefined,
        overrideRules:
          dto.overrideRules === undefined
            ? undefined
            : this.toJson(dto.overrideRules),
        customRequirement: dto.customRequirement?.trim(),
        previewMode: dto.previewMode || 'SIMPLE',
      },
      include: {
        template: {
          include: {
            ...this.includeScope(),
            rules: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
          },
        },
      },
    });
    return {
      setting,
      template: setting.template,
      rulesSummary: setting.templateId
        ? await this.getRulesSummary(setting.templateId)
        : [],
    };
  }

  async applyFormatTemplate(
    documentId: string,
    templateId: string,
    keepOverrides: boolean | undefined,
    actor: Actor,
  ) {
    await this.assertDocumentAccess(documentId, actor);
    await this.assertEnabledTemplate(templateId);
    const existing = await this.prisma.thesisDocumentFormatSetting.findUnique({
      where: { documentId },
    });
    const setting = await this.prisma.thesisDocumentFormatSetting.upsert({
      where: { documentId },
      update: {
        template: { connect: { id: templateId } },
        overrideRules: keepOverrides
          ? (existing?.overrideRules ?? undefined)
          : Prisma.JsonNull,
      },
      create: {
        document: { connect: { id: documentId } },
        template: { connect: { id: templateId } },
        overrideRules: keepOverrides
          ? (existing?.overrideRules ?? undefined)
          : undefined,
        customRequirement: existing?.customRequirement ?? undefined,
        previewMode: existing?.previewMode ?? 'SIMPLE',
      },
      include: {
        template: {
          include: {
            ...this.includeScope(),
            rules: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
          },
        },
      },
    });
    return {
      setting,
      template: setting.template,
      rulesSummary: await this.getRulesSummary(templateId),
      message: keepOverrides
        ? '已应用模板，并保留局部调整。'
        : '已应用模板，并清空局部调整。',
    };
  }

  async getDefaultTemplateForTask(
    taskId: string,
    options?: { stage?: string; exportFormat?: string },
  ) {
    const templates = await this.resolveExportTemplatesForTask(taskId, options);
    if (!templates.length)
      throw new BadRequestException(
        '未找到可用格式模板，请联系管理员创建全局通用模板',
      );
    return templates[0];
  }

  private includeScope() {
    return {
      school: { select: { id: true, name: true } },
      college: { select: { id: true, name: true } },
      major: { select: { id: true, name: true } },
    } satisfies Prisma.ThesisFormatTemplateInclude;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    if (value === undefined || value === null || value === '') return {};
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Prisma.InputJsonValue;
      } catch {
        throw new BadRequestException(
          'ruleValue / overrideRules 必须是合法 JSON',
        );
      }
    }
    if (typeof value !== 'object')
      throw new BadRequestException(
        'ruleValue / overrideRules 必须是 JSON 对象或数组',
      );
    return value;
  }

  private inferTemplateType(dto: Partial<CreateThesisFormatTemplateDto>) {
    if (dto.majorId) return ThesisFormatTemplateType.MAJOR;
    if (dto.collegeId) return ThesisFormatTemplateType.COLLEGE;
    if (dto.schoolId) return ThesisFormatTemplateType.SCHOOL;
    return ThesisFormatTemplateType.GENERAL;
  }

  private async validateScope(dto: Partial<CreateThesisFormatTemplateDto>) {
    if (dto.schoolId) {
      const school = await this.prisma.academicSchool.findFirst({
        where: { id: dto.schoolId, status: 'ACTIVE' },
      });
      if (!school) throw new BadRequestException('高校不存在或已停用');
    }
    if (dto.collegeId) {
      const college = await this.prisma.academicCollege.findFirst({
        where: { id: dto.collegeId, status: 'ACTIVE' },
      });
      if (!college) throw new BadRequestException('学院不存在或已停用');
      if (dto.schoolId && college.schoolId !== dto.schoolId)
        throw new BadRequestException('学院不属于所选高校');
    }
    if (dto.majorId) {
      const major = await this.prisma.academicMajor.findFirst({
        where: { id: dto.majorId, status: 'ACTIVE' },
      });
      if (!major) throw new BadRequestException('专业不存在或已停用');
      if (dto.schoolId && major.schoolId !== dto.schoolId)
        throw new BadRequestException('专业不属于所选高校');
      if (dto.collegeId && major.collegeId !== dto.collegeId)
        throw new BadRequestException('专业不属于所选学院');
    }
  }

  private async withRuleSummaries<T extends { id: string }>(templates: T[]) {
    return Promise.all(
      templates.map((template) => this.withRuleSummary(template.id, template)),
    );
  }

  private async withRuleSummary<T extends { id: string }>(
    templateId: string,
    template?: T,
  ) {
    const item =
      template ??
      (await this.prisma.thesisFormatTemplate.findUnique({
        where: { id: templateId },
        include: this.includeScope(),
      }));
    if (!item) return null;
    return { ...item, rulesSummary: await this.getRulesSummary(templateId) };
  }

  private async getRulesSummary(templateId: string) {
    const rules = await this.prisma.thesisFormatRule.findMany({
      where: { templateId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rules.map((rule) => ({
      id: rule.id,
      ruleType: rule.ruleType,
      ruleKey: rule.ruleKey,
      ruleValue: rule.ruleValue,
      description: rule.description,
      sortOrder: rule.sortOrder,
    }));
  }

  private async assertEnabledTemplate(templateId: string) {
    const template = await this.prisma.thesisFormatTemplate.findFirst({
      where: { id: templateId, status: ThesisFormatTemplateStatus.ENABLED },
    });
    if (!template) throw new BadRequestException('格式模板不存在或已禁用');
    return template;
  }

  private async assertTaskAccess(taskId: string, actor: Actor) {
    if (
      actor.admin ||
      actor.role === UserRole.ADMIN ||
      actor.role === UserRole.SUPER_ADMIN
    )
      return;
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { userId: true },
    });
    if (!task) throw new NotFoundException('任务不存在');
    if (task.userId !== actor.id)
      throw new ForbiddenException('无权访问该论文任务');
  }

  private async assertDocumentAccess(documentId: string, actor: Actor) {
    const document = await this.prisma.thesisDocument.findUnique({
      where: { id: documentId },
      include: {
        task: { select: { id: true, userId: true, currentStage: true } },
      },
    });
    if (!document) throw new NotFoundException('论文文档不存在');
    if (
      !(
        actor.admin ||
        actor.role === UserRole.ADMIN ||
        actor.role === UserRole.SUPER_ADMIN
      ) &&
      document.task.userId !== actor.id
    )
      throw new ForbiddenException('无权访问该论文文档');
    return document;
  }

  private scoreTemplate(
    template: {
      majorId: string | null;
      collegeId: string | null;
      schoolId: string | null;
      educationLevel: string | null;
      thesisType: string | null;
      stage: string | null;
      isDefault: boolean;
      sortOrder: number;
      version: number;
    },
    task: {
      majorId: string | null;
      collegeId: string | null;
      academicSchoolId: string | null;
      educationLevel: string;
      thesisType: string | null;
    },
    stage?: string,
  ) {
    if (template.majorId && template.majorId !== task.majorId) return -1;
    if (template.collegeId && template.collegeId !== task.collegeId) return -1;
    if (template.schoolId && template.schoolId !== task.academicSchoolId)
      return -1;
    if (
      template.educationLevel &&
      template.educationLevel !== task.educationLevel
    )
      return -1;
    if (template.thesisType && template.thesisType !== task.thesisType)
      return -1;
    if (template.stage && template.stage !== stage) return -1;
    let score = 0;
    if (template.majorId) score += 500;
    if (template.collegeId) score += 400;
    if (template.schoolId) score += 300;
    if (template.educationLevel) score += 60;
    if (template.thesisType) score += 40;
    if (template.stage) score += 30;
    if (template.isDefault) score += 10;
    return score;
  }
}
