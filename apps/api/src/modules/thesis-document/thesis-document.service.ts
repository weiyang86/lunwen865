import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ThesisAdvisorCommentStatus,
  ThesisDocumentMergeMode,
  ThesisDocumentSectionType,
  ThesisDocumentStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskService } from '../task/task.service';
import type {
  CreateAdvisorCommentDto,
  CreateDocumentSectionDto,
  MergeStageContentDto,
  QueryRevisionsDto,
  UpdateAdvisorCommentDto,
  UpdateDocumentSectionDto,
  UpdateThesisDocumentDto,
} from './dto/thesis-document.dto';

type Actor = { id: string; role?: string | null; admin?: boolean };

type TaskSummaryInput = {
  id: string;
  title: string | null;
  currentStage: string | null;
  status: string;
  educationLevel: string;
  thesisType: string | null;
  researchDirection: string | null;
  advisorRequirement: string | null;
  major: string;
  academicSchool?: { name: string } | null;
  college?: { name: string } | null;
  academicMajor?: { name: string } | null;
  disciplineCategory?: { name: string } | null;
  disciplineLevelOne?: { name: string } | null;
  disciplineLevelTwo?: { name: string } | null;
};

type SectionNode = Prisma.ThesisDocumentSectionGetPayload<{
  include: { children: true };
}> & { children: SectionNode[] };

function stripMarkup(content?: string | null) {
  return (content ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~\-[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(content?: string | null) {
  const text = stripMarkup(content);
  if (!text) return 0;
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const english =
    text
      .replace(/[\u4e00-\u9fa5]/g, ' ')
      .match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
  return chinese + english;
}

function stageLabel(stage: string) {
  const key = stage.toUpperCase();
  if (key.includes('TOPIC')) return '题目';
  if (key.includes('OPENING') || key.includes('PROPOSAL')) return '开题报告';
  if (key.includes('OUTLINE')) return '论文大纲';
  if (key.includes('REFERENCE')) return '参考文献';
  if (key.includes('ABSTRACT')) return '摘要';
  return stage;
}

@Injectable()
export class ThesisDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
  ) {}

  async getTaskDocument(taskId: string, actor: Actor) {
    await this.assertTaskAccess(taskId, actor);
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        academicSchool: true,
        college: true,
        academicMajor: true,
        disciplineCategory: true,
        disciplineLevelOne: true,
        disciplineLevelTwo: true,
      },
    });
    if (!task) throw new NotFoundException('任务不存在');
    const document = await this.prisma.thesisDocument.findUnique({
      where: { taskId },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    const advisorComments = document
      ? await this.prisma.thesisAdvisorComment.findMany({
          where: { documentId: document.id },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    return {
      task: this.taskSummary(task),
      document: document
        ? { ...document, sections: this.buildTree(document.sections) }
        : null,
      advisorComments,
      canInit: !document,
    };
  }

  async initDocument(taskId: string, actor: Actor) {
    await this.assertTaskAccess(taskId, actor);
    const existed = await this.prisma.thesisDocument.findUnique({
      where: { taskId },
    });
    if (existed) return this.getTaskDocument(taskId, actor);

    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('任务不存在');
    const title = task.title?.trim() || '未命名论文文档';
    const sections = this.defaultSections(task.thesisType ?? undefined).map(
      (item, index) => {
        const content =
          'content' in item && typeof item.content === 'string'
            ? item.content
            : '';
        return {
          ...item,
          content,
          plainText: stripMarkup(content),
          wordCount: countWords(content),
          sortOrder: (index + 1) * 10,
        };
      },
    );
    await this.prisma.thesisDocument.create({
      data: {
        taskId,
        title,
        status: ThesisDocumentStatus.DRAFT,
        wordCount: sections.reduce((sum, item) => sum + item.wordCount, 0),
        sections: { create: sections },
      },
    });
    return this.getTaskDocument(taskId, actor);
  }

  async updateDocument(
    documentId: string,
    dto: UpdateThesisDocumentDto,
    actor: Actor,
  ) {
    const document = await this.assertDocumentAccess(documentId, actor);
    await this.prisma.thesisDocument.update({
      where: { id: document.id },
      data: {
        title: dto.title?.trim() || undefined,
        abstract: dto.abstract,
        keywords:
          dto.keywords === undefined
            ? undefined
            : (dto.keywords as Prisma.InputJsonValue),
        status: dto.status,
      },
    });
    return this.getTaskDocument(document.taskId, actor);
  }

  async createSection(
    documentId: string,
    dto: CreateDocumentSectionDto,
    actor: Actor,
  ) {
    await this.assertDocumentAccess(documentId, actor);
    if (dto.parentId)
      await this.assertSectionInDocument(dto.parentId, documentId);
    const content = dto.content ?? '';
    const section = await this.prisma.thesisDocumentSection.create({
      data: {
        documentId,
        parentId: dto.parentId || null,
        sectionType: dto.sectionType ?? ThesisDocumentSectionType.SECTION,
        title: dto.title.trim() || '未命名章节',
        content,
        plainText: stripMarkup(content),
        sortOrder:
          dto.sortOrder ?? (await this.nextSortOrder(documentId, dto.parentId)),
        level: dto.level ?? (dto.parentId ? 2 : 1),
        wordCount: countWords(content),
        sourceStage: dto.sourceStage,
        sourceGenerationRunId: dto.sourceGenerationRunId,
      },
    });
    await this.recalculateDocument(documentId);
    return section;
  }

  async updateSection(
    sectionId: string,
    dto: UpdateDocumentSectionDto,
    actor: Actor,
  ) {
    const section = await this.prisma.thesisDocumentSection.findUnique({
      where: { id: sectionId },
      include: { document: true },
    });
    if (!section || section.deletedAt)
      throw new NotFoundException('章节不存在');
    await this.assertDocumentAccess(section.documentId, actor);
    const beforeContent = section.content ?? '';
    const afterContent =
      dto.content === undefined ? beforeContent : dto.content;
    const changed = beforeContent !== afterContent;
    const plainText = stripMarkup(afterContent);
    const wordCount = countWords(afterContent);
    const result = await this.prisma.$transaction(async (tx) => {
      let nextVersion = section.document.currentVersion;
      if (changed) {
        nextVersion += 1;
        await tx.thesisDocumentRevision.create({
          data: {
            documentId: section.documentId,
            sectionId: section.id,
            version: nextVersion,
            beforeContent,
            afterContent,
            changeSummary: this.changeSummary(beforeContent, afterContent),
            operatorId: actor.id,
            operatorRole: actor.role ?? UserRole.USER,
          },
        });
      }
      const updated = await tx.thesisDocumentSection.update({
        where: { id: section.id },
        data: {
          title: dto.title?.trim() || undefined,
          sectionType: dto.sectionType,
          content: dto.content,
          plainText: dto.content === undefined ? undefined : plainText,
          wordCount: dto.content === undefined ? undefined : wordCount,
          sortOrder: dto.sortOrder,
          level: dto.level,
        },
      });
      if (changed) {
        await tx.thesisDocument.update({
          where: { id: section.documentId },
          data: {
            currentVersion: nextVersion,
            status: ThesisDocumentStatus.EDITING,
          },
        });
      }
      return { updated, version: nextVersion, revisionCreated: changed };
    });
    await this.recalculateDocument(section.documentId);
    return result;
  }

  async deleteSection(sectionId: string, actor: Actor) {
    const section = await this.prisma.thesisDocumentSection.findUnique({
      where: { id: sectionId },
    });
    if (!section || section.deletedAt)
      throw new NotFoundException('章节不存在');
    await this.assertDocumentAccess(section.documentId, actor);
    await this.prisma.thesisDocumentSection.updateMany({
      where: {
        OR: [{ id: sectionId }, { parentId: sectionId }],
        documentId: section.documentId,
      },
      data: { deletedAt: new Date() },
    });
    await this.recalculateDocument(section.documentId);
    return { success: true };
  }

  async mergeStageContent(
    documentId: string,
    dto: MergeStageContentDto,
    actor: Actor,
  ) {
    const document = await this.assertDocumentAccess(documentId, actor);
    const source = await this.resolveStageContent(document.taskId, dto);
    if (!source.content.trim())
      throw new BadRequestException('未找到可合并的阶段内容');
    if (dto.generationRunId) {
      const duplicated = await this.prisma.thesisDocumentSection.findFirst({
        where: {
          documentId,
          sourceGenerationRunId: dto.generationRunId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (duplicated)
        throw new BadRequestException('该生成结果已合并，请勿重复导入');
    }
    const mode = dto.mode ?? ThesisDocumentMergeMode.APPEND;
    if (mode === ThesisDocumentMergeMode.REPLACE_SECTION && dto.sectionId) {
      return this.updateSection(
        dto.sectionId,
        { content: source.content, title: source.title },
        actor,
      );
    }
    const section = await this.createSection(
      documentId,
      {
        title: source.title,
        content: source.content,
        sectionType: source.sectionType,
        sourceStage: dto.stage,
        sourceGenerationRunId: dto.generationRunId,
      },
      actor,
    );
    return { section, mode: ThesisDocumentMergeMode.APPEND };
  }

  async listRevisions(documentId: string, q: QueryRevisionsDto, actor: Actor) {
    await this.assertDocumentAccess(documentId, actor);
    const where: Prisma.ThesisDocumentRevisionWhereInput = { documentId };
    if (q.sectionId) where.sectionId = q.sectionId;
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 20));
    const [total, list] = await this.prisma.$transaction([
      this.prisma.thesisDocumentRevision.count({ where }),
      this.prisma.thesisDocumentRevision.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          section: { select: { id: true, title: true } },
          operator: { select: { id: true, nickname: true, email: true } },
        },
      }),
    ]);
    return { list, total, page, pageSize };
  }

  async createAdvisorComment(
    documentId: string,
    dto: CreateAdvisorCommentDto,
    actor: Actor,
  ) {
    const document = await this.assertDocumentAccess(documentId, actor);
    if (dto.sectionId)
      await this.assertSectionInDocument(dto.sectionId, documentId);
    return this.prisma.thesisAdvisorComment.create({
      data: {
        taskId: document.taskId,
        documentId,
        sectionId: dto.sectionId || null,
        commentText: dto.commentText.trim(),
        status: ThesisAdvisorCommentStatus.OPEN,
      },
    });
  }

  async updateAdvisorComment(
    commentId: string,
    dto: UpdateAdvisorCommentDto,
    actor: Actor,
  ) {
    const comment = await this.prisma.thesisAdvisorComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('导师意见不存在');
    await this.assertDocumentAccess(comment.documentId, actor);
    const status = dto.status;
    return this.prisma.thesisAdvisorComment.update({
      where: { id: commentId },
      data: {
        commentText: dto.commentText?.trim(),
        status,
        resolvedAt:
          status === ThesisAdvisorCommentStatus.RESOLVED
            ? new Date()
            : status
              ? null
              : undefined,
      },
    });
  }

  async getAdminTaskDocument(taskId: string) {
    return this.getTaskDocument(taskId, {
      id: 'admin',
      admin: true,
      role: UserRole.ADMIN,
    });
  }

  private async assertTaskAccess(taskId: string, actor: Actor) {
    if (actor.admin) return;
    await this.taskService.assertTaskOwnership(taskId, actor.id);
  }

  private async assertDocumentAccess(documentId: string, actor: Actor) {
    const document = await this.prisma.thesisDocument.findUnique({
      where: { id: documentId },
    });
    if (!document) throw new NotFoundException('论文文档不存在');
    if (!actor.admin)
      await this.taskService.assertTaskOwnership(document.taskId, actor.id);
    return document;
  }

  private async assertSectionInDocument(sectionId: string, documentId: string) {
    const section = await this.prisma.thesisDocumentSection.findFirst({
      where: { id: sectionId, documentId, deletedAt: null },
    });
    if (!section) throw new BadRequestException('章节不存在或不属于当前文档');
    return section;
  }

  private buildTree(
    sections: Prisma.ThesisDocumentSectionGetPayload<object>[],
  ) {
    const map = new Map<string, SectionNode>();
    const roots: SectionNode[] = [];
    for (const section of sections)
      map.set(section.id, { ...section, children: [] });
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId))
        map.get(node.parentId)!.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  private defaultSections(thesisType?: string) {
    const light = thesisType === 'PROPOSAL' || thesisType === 'OUTLINE';
    if (light) {
      return [
        {
          sectionType: ThesisDocumentSectionType.TITLE,
          title: '题目',
          level: 1,
        },
        {
          sectionType: ThesisDocumentSectionType.CHAPTER,
          title: '一、研究背景与意义',
          level: 1,
        },
        {
          sectionType: ThesisDocumentSectionType.CHAPTER,
          title: '二、研究内容与方法',
          level: 1,
        },
        {
          sectionType: ThesisDocumentSectionType.CHAPTER,
          title: '三、进度安排',
          level: 1,
        },
        {
          sectionType: ThesisDocumentSectionType.REFERENCE,
          title: '参考文献',
          level: 1,
        },
      ];
    }
    return [
      { sectionType: ThesisDocumentSectionType.TITLE, title: '题目', level: 1 },
      {
        sectionType: ThesisDocumentSectionType.ABSTRACT,
        title: '摘要',
        level: 1,
      },
      {
        sectionType: ThesisDocumentSectionType.KEYWORDS,
        title: '关键词',
        level: 1,
      },
      {
        sectionType: ThesisDocumentSectionType.CHAPTER,
        title: '第一章 绪论',
        level: 1,
      },
      {
        sectionType: ThesisDocumentSectionType.CHAPTER,
        title: '第二章 相关理论与研究综述',
        level: 1,
      },
      {
        sectionType: ThesisDocumentSectionType.CHAPTER,
        title: '第三章 研究设计',
        level: 1,
      },
      {
        sectionType: ThesisDocumentSectionType.CHAPTER,
        title: '第四章 分析与讨论',
        level: 1,
      },
      {
        sectionType: ThesisDocumentSectionType.CHAPTER,
        title: '第五章 结论与建议',
        level: 1,
      },
      {
        sectionType: ThesisDocumentSectionType.REFERENCE,
        title: '参考文献',
        level: 1,
      },
      {
        sectionType: ThesisDocumentSectionType.ACKNOWLEDGEMENT,
        title: '致谢',
        level: 1,
      },
    ];
  }

  private async nextSortOrder(documentId: string, parentId?: string) {
    const latest = await this.prisma.thesisDocumentSection.findFirst({
      where: { documentId, parentId: parentId || null, deletedAt: null },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (latest?.sortOrder ?? 0) + 10;
  }

  private async recalculateDocument(documentId: string) {
    const sections = await this.prisma.thesisDocumentSection.findMany({
      where: { documentId, deletedAt: null },
      select: { wordCount: true },
    });
    const wordCount = sections.reduce((sum, item) => sum + item.wordCount, 0);
    await this.prisma.thesisDocument.update({
      where: { id: documentId },
      data: { wordCount },
    });
  }

  private changeSummary(beforeContent: string, afterContent: string) {
    return `字数 ${countWords(beforeContent)} → ${countWords(afterContent)}`;
  }

  private taskSummary(task: TaskSummaryInput) {
    return {
      id: task.id,
      title: task.title,
      currentStage: task.currentStage,
      status: task.status,
      educationLevel: task.educationLevel,
      thesisType: task.thesisType,
      researchDirection: task.researchDirection,
      advisorRequirement: task.advisorRequirement,
      schoolName: task.academicSchool?.name ?? null,
      collegeName: task.college?.name ?? null,
      majorName: task.academicMajor?.name ?? task.major ?? null,
      disciplineCategoryName: task.disciplineCategory?.name ?? null,
      disciplineLevelOneName: task.disciplineLevelOne?.name ?? null,
      disciplineLevelTwoName: task.disciplineLevelTwo?.name ?? null,
    };
  }

  private async resolveStageContent(taskId: string, dto: MergeStageContentDto) {
    if (dto.generationRunId) {
      const run = await this.prisma.aiGenerationRun.findFirst({
        where: { id: dto.generationRunId, taskId },
      });
      if (!run) throw new BadRequestException('未找到指定生成记录');
      return {
        title: `${stageLabel(dto.stage)}合并内容`,
        content: JSON.stringify(run.outputSnapshot ?? {}, null, 2),
        sectionType: ThesisDocumentSectionType.SECTION,
      };
    }
    const stage = dto.stage.toUpperCase();
    if (stage.includes('TOPIC')) {
      const topic = await this.prisma.topicCandidate.findFirst({
        where: { taskId, isSelected: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!topic) throw new BadRequestException('未找到已选题目内容');
      return {
        title: '题目',
        content: `${topic.title}\n\n${topic.description ?? ''}`.trim(),
        sectionType: ThesisDocumentSectionType.TITLE,
      };
    }
    if (stage.includes('OPENING') || stage.includes('PROPOSAL')) {
      const report = await this.prisma.openingReport.findFirst({
        where: { taskId },
        orderBy: { version: 'desc' },
        include: { sections: { orderBy: { sectionIndex: 'asc' } } },
      });
      if (!report) throw new BadRequestException('未找到开题报告内容');
      const content =
        report.fullContent ||
        report.sections
          .map((s) => `## ${s.sectionTitle}\n${s.content ?? ''}`)
          .join('\n\n');
      return {
        title: '开题报告',
        content,
        sectionType: ThesisDocumentSectionType.CHAPTER,
      };
    }
    if (stage.includes('OUTLINE')) {
      const outline = await this.prisma.outline.findUnique({
        where: { taskId },
        include: { nodes: { orderBy: { path: 'asc' } } },
      });
      if (!outline) throw new BadRequestException('未找到论文大纲内容');
      const content = outline.nodes
        .map(
          (n) =>
            `${'#'.repeat(Math.min(n.depth + 1, 6))} ${n.title}\n${n.summary ?? ''}`,
        )
        .join('\n\n');
      return {
        title: '论文大纲',
        content,
        sectionType: ThesisDocumentSectionType.CHAPTER,
      };
    }
    if (stage.includes('REFERENCE')) {
      const refs = await this.prisma.reference.findMany({
        where: { taskId },
        orderBy: { index: 'asc' },
      });
      if (!refs.length) throw new BadRequestException('未找到参考文献内容');
      const content = refs
        .map(
          (r) =>
            `[${r.index}] ${r.authors}. ${r.title}.${r.journal ?? r.publisher ?? ''}, ${r.year ?? ''}.`,
        )
        .join('\n');
      return {
        title: '参考文献',
        content,
        sectionType: ThesisDocumentSectionType.REFERENCE,
      };
    }
    const chapters = await this.prisma.chapter.findMany({
      where: { taskId },
      orderBy: { index: 'asc' },
      include: { sections: { orderBy: { index: 'asc' } } },
    });
    if (!chapters.length)
      throw new BadRequestException('未找到可合并的正文内容');
    const content = chapters
      .map(
        (c) =>
          `# ${c.title}\n${c.sections.map((s) => `## ${s.title}\n${s.content ?? ''}`).join('\n\n')}`,
      )
      .join('\n\n');
    return {
      title: '正文初稿',
      content,
      sectionType: ThesisDocumentSectionType.CHAPTER,
    };
  }
}
