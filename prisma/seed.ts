import { AcademicStatus, PrismaClient, ThesisFormatRuleType, ThesisFormatTemplateStatus, ThesisFormatTemplateType, ThesisSkillCategory, ThesisSkillStage, ThesisSkillStatus, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';


async function seedAcademicData(prisma: PrismaClient) {
  const chongqing = await prisma.academicProvince.upsert({
    where: { code: 'cq' },
    update: { name: '重庆', status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { code: 'cq', name: '重庆', status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });
  const sichuan = await prisma.academicProvince.upsert({
    where: { code: 'sc' },
    update: { name: '四川', status: AcademicStatus.ACTIVE, sortOrder: 20 },
    create: { code: 'sc', name: '四川', status: AcademicStatus.ACTIVE, sortOrder: 20 },
  });

  const cqCity = await prisma.academicCity.upsert({
    where: { provinceId_code: { provinceId: chongqing.id, code: 'cq' } },
    update: { name: '重庆', status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { provinceId: chongqing.id, code: 'cq', name: '重庆', status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });
  const chengdu = await prisma.academicCity.upsert({
    where: { provinceId_code: { provinceId: sichuan.id, code: 'cd' } },
    update: { name: '成都', status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { provinceId: sichuan.id, code: 'cd', name: '成都', status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });
  await prisma.academicCity.upsert({
    where: { provinceId_code: { provinceId: sichuan.id, code: 'gzz' } },
    update: { name: '甘孜州', status: AcademicStatus.ACTIVE, sortOrder: 20 },
    create: { provinceId: sichuan.id, code: 'gzz', name: '甘孜州', status: AcademicStatus.ACTIVE, sortOrder: 20 },
  });

  const engineering = await prisma.disciplineCategory.upsert({
    where: { code: 'engineering' },
    update: { name: '工学', status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { code: 'engineering', name: '工学', status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });
  const management = await prisma.disciplineCategory.upsert({
    where: { code: 'management' },
    update: { name: '管理学', status: AcademicStatus.ACTIVE, sortOrder: 20 },
    create: { code: 'management', name: '管理学', status: AcademicStatus.ACTIVE, sortOrder: 20 },
  });
  const education = await prisma.disciplineCategory.upsert({
    where: { code: 'education' },
    update: { name: '教育学', status: AcademicStatus.ACTIVE, sortOrder: 30 },
    create: { code: 'education', name: '教育学', status: AcademicStatus.ACTIVE, sortOrder: 30 },
  });
  const literature = await prisma.disciplineCategory.upsert({
    where: { code: 'literature' },
    update: { name: '文学', status: AcademicStatus.ACTIVE, sortOrder: 40 },
    create: { code: 'literature', name: '文学', status: AcademicStatus.ACTIVE, sortOrder: 40 },
  });

  const computer = await prisma.disciplineLevelOne.upsert({
    where: { categoryId_code: { categoryId: engineering.id, code: 'computer' } },
    update: { name: '计算机类', status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { categoryId: engineering.id, code: 'computer', name: '计算机类', status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });
  const managementScience = await prisma.disciplineLevelOne.upsert({
    where: { categoryId_code: { categoryId: management.id, code: 'management-science' } },
    update: { name: '管理科学与工程类', status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { categoryId: management.id, code: 'management-science', name: '管理科学与工程类', status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });
  const educationLevel = await prisma.disciplineLevelOne.upsert({
    where: { categoryId_code: { categoryId: education.id, code: 'education-major' } },
    update: { name: '教育学类', status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { categoryId: education.id, code: 'education-major', name: '教育学类', status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });
  const chinese = await prisma.disciplineLevelOne.upsert({
    where: { categoryId_code: { categoryId: literature.id, code: 'chinese-language' } },
    update: { name: '中国语言文学类', status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { categoryId: literature.id, code: 'chinese-language', name: '中国语言文学类', status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });

  const cs = await prisma.disciplineLevelTwo.upsert({
    where: { levelOneId_code: { levelOneId: computer.id, code: 'cs' } },
    update: { name: '计算机科学与技术', status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { levelOneId: computer.id, code: 'cs', name: '计算机科学与技术', status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });
  const software = await prisma.disciplineLevelTwo.upsert({
    where: { levelOneId_code: { levelOneId: computer.id, code: 'software' } },
    update: { name: '软件工程', status: AcademicStatus.ACTIVE, sortOrder: 20 },
    create: { levelOneId: computer.id, code: 'software', name: '软件工程', status: AcademicStatus.ACTIVE, sortOrder: 20 },
  });
  const cost = await prisma.disciplineLevelTwo.upsert({
    where: { levelOneId_code: { levelOneId: managementScience.id, code: 'cost-engineering' } },
    update: { name: '工程造价', status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { levelOneId: managementScience.id, code: 'cost-engineering', name: '工程造价', status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });
  const eduTech = await prisma.disciplineLevelTwo.upsert({
    where: { levelOneId_code: { levelOneId: educationLevel.id, code: 'edu-tech' } },
    update: { name: '教育技术学', status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { levelOneId: educationLevel.id, code: 'edu-tech', name: '教育技术学', status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });
  const chineseLang = await prisma.disciplineLevelTwo.upsert({
    where: { levelOneId_code: { levelOneId: chinese.id, code: 'chinese-language-literature' } },
    update: { name: '汉语言文学', status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { levelOneId: chinese.id, code: 'chinese-language-literature', name: '汉语言文学', status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });

  const cqnu = await prisma.academicSchool.upsert({
    where: { code: 'cqnu' },
    update: { provinceId: chongqing.id, cityId: cqCity.id, name: '重庆师范大学', schoolType: 'NORMAL', educationLevels: ['UNDERGRADUATE', 'MASTER'], status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { provinceId: chongqing.id, cityId: cqCity.id, code: 'cqnu', name: '重庆师范大学', schoolType: 'NORMAL', educationLevels: ['UNDERGRADUATE', 'MASTER'], status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });
  const cqjzy = await prisma.academicSchool.upsert({
    where: { code: 'cqjzy' },
    update: { provinceId: chongqing.id, cityId: cqCity.id, name: '重庆建筑工程职业学院', schoolType: 'VOCATIONAL', educationLevels: ['JUNIOR_COLLEGE'], status: AcademicStatus.ACTIVE, sortOrder: 20 },
    create: { provinceId: chongqing.id, cityId: cqCity.id, code: 'cqjzy', name: '重庆建筑工程职业学院', schoolType: 'VOCATIONAL', educationLevels: ['JUNIOR_COLLEGE'], status: AcademicStatus.ACTIVE, sortOrder: 20 },
  });

  const computerCollege = await prisma.academicCollege.upsert({
    where: { schoolId_name: { schoolId: cqnu.id, name: '计算机与信息科学学院' } },
    update: { code: 'computer', status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { schoolId: cqnu.id, code: 'computer', name: '计算机与信息科学学院', status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });
  const literatureCollege = await prisma.academicCollege.upsert({
    where: { schoolId_name: { schoolId: cqnu.id, name: '文学院' } },
    update: { code: 'literature', status: AcademicStatus.ACTIVE, sortOrder: 20 },
    create: { schoolId: cqnu.id, code: 'literature', name: '文学院', status: AcademicStatus.ACTIVE, sortOrder: 20 },
  });
  const buildCollege = await prisma.academicCollege.upsert({
    where: { schoolId_name: { schoolId: cqjzy.id, name: '建设管理学院' } },
    update: { code: 'construction-management', status: AcademicStatus.ACTIVE, sortOrder: 10 },
    create: { schoolId: cqjzy.id, code: 'construction-management', name: '建设管理学院', status: AcademicStatus.ACTIVE, sortOrder: 10 },
  });

  const majors = [
    { schoolId: cqnu.id, collegeId: computerCollege.id, categoryId: engineering.id, levelOneId: computer.id, levelTwoId: cs.id, name: '计算机科学与技术', code: '080901', educationLevel: 'UNDERGRADUATE', sortOrder: 10 },
    { schoolId: cqnu.id, collegeId: computerCollege.id, categoryId: engineering.id, levelOneId: computer.id, levelTwoId: software.id, name: '软件工程', code: '080902', educationLevel: 'UNDERGRADUATE', sortOrder: 20 },
    { schoolId: cqjzy.id, collegeId: buildCollege.id, categoryId: management.id, levelOneId: managementScience.id, levelTwoId: cost.id, name: '工程造价', code: '440501', educationLevel: 'JUNIOR_COLLEGE', sortOrder: 10 },
    { schoolId: cqnu.id, collegeId: computerCollege.id, categoryId: education.id, levelOneId: educationLevel.id, levelTwoId: eduTech.id, name: '教育技术学', code: '040104', educationLevel: 'UNDERGRADUATE', sortOrder: 30 },
    { schoolId: cqnu.id, collegeId: literatureCollege.id, categoryId: literature.id, levelOneId: chinese.id, levelTwoId: chineseLang.id, name: '汉语言文学', code: '050101', educationLevel: 'UNDERGRADUATE', sortOrder: 10 },
  ];

  for (const major of majors) {
    const existed = await prisma.academicMajor.findFirst({
      where: { schoolId: major.schoolId, collegeId: major.collegeId, name: major.name, educationLevel: major.educationLevel },
      select: { id: true },
    });
    const data = {
      schoolId: major.schoolId,
      collegeId: major.collegeId,
      disciplineCategoryId: major.categoryId,
      disciplineLevelOneId: major.levelOneId,
      disciplineLevelTwoId: major.levelTwoId,
      name: major.name,
      code: major.code,
      educationLevel: major.educationLevel,
      status: AcademicStatus.ACTIVE,
      sortOrder: major.sortOrder,
    };
    if (existed) await prisma.academicMajor.update({ where: { id: existed.id }, data });
    else await prisma.academicMajor.create({ data });
  }

  console.log('[seed] academic data upserted:', {
    provinces: ['重庆', '四川'],
    cities: ['重庆', '成都', '甘孜州'],
    schools: ['重庆师范大学', '重庆建筑工程职业学院'],
  });
}


const DEFAULT_SKILL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    taskTitle: { type: 'string' },
    schoolName: { type: 'string' },
    collegeName: { type: 'string' },
    majorName: { type: 'string' },
    educationLevel: { type: 'string' },
    thesisType: { type: 'string' },
    stage: { type: 'string' },
    researchDirection: { type: 'string' },
    advisorRequirement: { type: 'string' },
    userRequirement: { type: 'string' },
  },
};

const DEFAULT_SKILL_MODEL_CONFIG = {
  provider: 'mock-preview',
  model: 'skill-preview-v1',
  temperature: 0.3,
  maxTokens: 2000,
};

function buildSkillPrompt(name: string, focus: string) {
  return `你是论文辅导与写作辅助系统中的「${name}」。

合规边界：
- 本系统仅用于论文辅导、结构优化、表达修改、格式检查与学习支持。
- 不用于代写、买卖论文、伪造实验/调研/访谈/问卷数据。
- 不伪造引用、DOI、期刊、作者、页码或不存在的文献。
- 降重相关能力仅提供表达优化、逻辑重写和规范引用建议，不承诺规避查重系统。
- 参考文献能力只能提供检索建议、格式建议和待核验提示。

任务上下文：
- 题目：{{taskTitle}}
- 学校：{{schoolName}}
- 学院：{{collegeName}}
- 专业：{{majorName}}
- 学历层次：{{educationLevel}}
- 论文类型：{{thesisType}}
- 阶段：{{stage}}
- 研究方向：{{researchDirection}}
- 导师要求：{{advisorRequirement}}
- 用户补充要求：{{userRequirement}}

请围绕「${focus}」输出结构化建议，明确列出待学生自行确认、待导师确认、待引用核验的事项。`;
}

async function seedThesisSkills(prisma: PrismaClient) {
  const skills = [
    { code: 'topic-generation', name: '选题生成 Skill', stage: ThesisSkillStage.TOPIC, category: ThesisSkillCategory.GENERATION, focus: '选题生成、选题理由、研究边界与可行性提示' },
    { code: 'proposal-report', name: '开题报告 Skill', stage: ThesisSkillStage.PROPOSAL, category: ThesisSkillCategory.GENERATION, focus: '开题报告结构、研究背景、研究意义、方法与进度计划' },
    { code: 'thesis-outline', name: '论文大纲 Skill', stage: ThesisSkillStage.OUTLINE, category: ThesisSkillCategory.GENERATION, focus: '章节结构、章节目标、逻辑关系和字数建议' },
    { code: 'full-paper-writing', name: '正文写作 Skill', stage: ThesisSkillStage.FULL_PAPER, category: ThesisSkillCategory.GENERATION, focus: '正文写作辅助、章节展开、论证逻辑和引用占位提示' },
    { code: 'advisor-revision', name: '导师意见修改 Skill', stage: ThesisSkillStage.REVISION, category: ThesisSkillCategory.REVISION, focus: '导师意见拆解、修改方案、修改前后差异说明' },
    { code: 'polishing-rewrite', name: '降重改写 Skill', stage: ThesisSkillStage.POLISHING, category: ThesisSkillCategory.REVISION, focus: '表达优化、逻辑重写、规范引用和重复风险提示' },
    { code: 'format-check', name: '格式检查 Skill', stage: ThesisSkillStage.FORMAT_CHECK, category: ThesisSkillCategory.CHECK, focus: '标题、目录、页眉页脚、参考文献、图表和学校格式要求检查' },
    { code: 'reference-suggestion', name: '参考文献建议 Skill', stage: ThesisSkillStage.REFERENCE, category: ThesisSkillCategory.CHECK, focus: '参考文献检索建议、格式规范和核验清单，不编造文献' },
    { code: 'abstract-keywords', name: '摘要与关键词 Skill', stage: ThesisSkillStage.ABSTRACT, category: ThesisSkillCategory.GENERATION, focus: '中英文摘要、关键词、研究目的方法结论的结构化表达' },
    { code: 'defense-ppt-outline', name: '答辩 PPT 大纲 Skill', stage: ThesisSkillStage.DEFENSE, category: ThesisSkillCategory.EXPORT_ASSIST, focus: '答辩 PPT 页结构、讲稿提纲、展示重点和答辩风险问题' },
  ];

  for (const [index, item] of skills.entries()) {
    const skill = await prisma.thesisSkill.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        stage: item.stage,
        category: item.category,
        status: ThesisSkillStatus.ENABLED,
        sortOrder: (index + 1) * 10,
        description: `${item.name}：用于${item.focus}。`,
      },
      create: {
        code: item.code,
        name: item.name,
        stage: item.stage,
        category: item.category,
        status: ThesisSkillStatus.ENABLED,
        sortOrder: (index + 1) * 10,
        description: `${item.name}：用于${item.focus}。`,
      },
    });

    const activeVersion = await prisma.thesisSkillVersion.findFirst({
      where: { skillId: skill.id, isActive: true },
      select: { version: true },
    });
    const activateSeedVersion = !activeVersion || activeVersion.version === 1;

    await prisma.thesisSkillVersion.upsert({
      where: { skillId_version: { skillId: skill.id, version: 1 } },
      update: {
        promptTemplate: buildSkillPrompt(item.name, item.focus),
        inputSchema: DEFAULT_SKILL_INPUT_SCHEMA,
        outputSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            sections: { type: 'array' },
            complianceNotes: { type: 'array' },
            verificationItems: { type: 'array' },
          },
        },
        qualityRules: {
          requireComplianceNotice: true,
          forbidFabricatedData: true,
          forbidFabricatedReferences: true,
          requireVerificationItems: true,
        },
        modelConfig: DEFAULT_SKILL_MODEL_CONFIG,
        isActive: activateSeedVersion,
        activeKey: activateSeedVersion ? skill.id : null,
        changeLog: '内置首版论文辅导 Skill，使用 mock-preview 测试运行。',
      },
      create: {
        skillId: skill.id,
        version: 1,
        promptTemplate: buildSkillPrompt(item.name, item.focus),
        inputSchema: DEFAULT_SKILL_INPUT_SCHEMA,
        outputSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            sections: { type: 'array' },
            complianceNotes: { type: 'array' },
            verificationItems: { type: 'array' },
          },
        },
        qualityRules: {
          requireComplianceNotice: true,
          forbidFabricatedData: true,
          forbidFabricatedReferences: true,
          requireVerificationItems: true,
        },
        modelConfig: DEFAULT_SKILL_MODEL_CONFIG,
        isActive: activateSeedVersion,
        activeKey: activateSeedVersion ? skill.id : null,
        changeLog: '内置首版论文辅导 Skill，使用 mock-preview 测试运行。',
      },
    });

    const existedBinding = await prisma.thesisSkillBinding.findFirst({
      where: { skillId: skill.id, skillVersionId: null, educationLevel: null, thesisType: null, schoolId: null, majorId: null },
      select: { id: true },
    });
    if (existedBinding) {
      await prisma.thesisSkillBinding.update({
        where: { id: existedBinding.id },
        data: { priority: 0, status: ThesisSkillStatus.ENABLED },
      });
    } else {
      await prisma.thesisSkillBinding.create({
        data: { skillId: skill.id, priority: 0, status: ThesisSkillStatus.ENABLED },
      });
    }
  }

  console.log('[seed] thesis skills upserted:', skills.map((x) => x.code));
}

async function upsertTemplateRule(
  prisma: PrismaClient,
  templateId: string,
  ruleKey: string,
  ruleType: ThesisFormatRuleType,
  ruleValue: object,
  description: string,
  sortOrder: number,
) {
  await prisma.thesisFormatRule.upsert({
    where: { templateId_ruleKey: { templateId, ruleKey } },
    update: { ruleType, ruleValue, description, sortOrder },
    create: { templateId, ruleKey, ruleType, ruleValue, description, sortOrder },
  });
}

async function seedThesisFormatTemplates(prisma: PrismaClient) {
  const commonRules = [
    ['page', ThesisFormatRuleType.PAGE, { paperSize: 'A4', marginTop: 2.5, marginBottom: 2.5, marginLeft: 3.0, marginRight: 2.5, unit: 'cm' }, 'A4 页面与常规论文页边距。', 10],
    ['body', ThesisFormatRuleType.BODY, { fontFamily: '宋体', fontSize: 12, fontSizeLabel: '小四', lineSpacing: 1.5, firstLineIndent: '2字符', paragraphSpacingBefore: 0, paragraphSpacingAfter: 0 }, '正文宋体小四，1.5 倍行距，首行缩进 2 字符。', 20],
    ['heading', ThesisFormatRuleType.HEADING, { heading1FontFamily: '黑体', heading1FontSize: 16, heading1FontSizeLabel: '三号', heading1Bold: true, heading1Alignment: 'center', heading2FontFamily: '黑体', heading2FontSize: 14, heading2FontSizeLabel: '四号', heading2Bold: true, heading2Alignment: 'left' }, '一级标题黑体三号居中，二级标题黑体四号左对齐。', 30],
    ['abstract', ThesisFormatRuleType.ABSTRACT, { title: '摘要', titleFontFamily: '黑体', titleFontSize: '三号', bodyFontFamily: '宋体', bodyFontSize: '小四', lineSpacing: 1.5 }, '摘要标题黑体三号，正文宋体小四。', 40],
    ['keywords', ThesisFormatRuleType.KEYWORDS, { label: '关键词', separator: '；', fontFamily: '宋体', fontSize: '小四' }, '关键词以中文分号分隔。', 50],
    ['reference', ThesisFormatRuleType.REFERENCE, { style: 'GB/T 7714', title: '参考文献', fontFamily: '宋体', fontSize: '小四', lineSpacing: 1.5 }, '参考文献按 GB/T 7714 风格进行排版辅助，需学生自行核验真实性。', 60],
    ['cover', ThesisFormatRuleType.COVER, { enabled: true, fields: ['schoolName', 'collegeName', 'majorName', 'studentName', 'advisorName', 'title', 'submitDate'] }, '封面字段按任务上下文和人工填写信息组合。', 70],
  ] as const;

  async function upsertTemplate(input: {
    code: string;
    name: string;
    description: string;
    educationLevel?: string | null;
    thesisType?: string | null;
    stage?: string | null;
    sortOrder: number;
    schoolId?: string | null;
    templateType?: ThesisFormatTemplateType;
  }) {
    const template = await prisma.thesisFormatTemplate.upsert({
      where: { code: input.code },
      update: {
        name: input.name,
        description: input.description,
        templateType: input.templateType ?? ThesisFormatTemplateType.GENERAL,
        schoolId: input.schoolId ?? null,
        educationLevel: input.educationLevel ?? null,
        thesisType: input.thesisType ?? null,
        stage: input.stage ?? null,
        isDefault: true,
        status: ThesisFormatTemplateStatus.ENABLED,
        version: 1,
        sortOrder: input.sortOrder,
      },
      create: {
        code: input.code,
        name: input.name,
        description: input.description,
        templateType: input.templateType ?? ThesisFormatTemplateType.GENERAL,
        schoolId: input.schoolId ?? null,
        educationLevel: input.educationLevel ?? null,
        thesisType: input.thesisType ?? null,
        stage: input.stage ?? null,
        isDefault: true,
        status: ThesisFormatTemplateStatus.ENABLED,
        version: 1,
        sortOrder: input.sortOrder,
      },
    });
    for (const [key, type, value, desc, sort] of commonRules) await upsertTemplateRule(prisma, template.id, key, type, value, desc, sort);
    return template;
  }

  await upsertTemplate({
    code: 'global-undergraduate-full-paper',
    name: '通用本科毕业论文模板',
    description: '通用本科毕业论文格式模板，用于论文辅导、格式整理和文档交付；导出文件需按学校正式模板和导师要求自行核验。',
    educationLevel: 'UNDERGRADUATE',
    thesisType: 'FULL_PAPER',
    sortOrder: 10,
  });
  await upsertTemplate({
    code: 'global-upgrade-undergraduate-full-paper',
    name: '通用专升本毕业论文模板',
    description: '通用专升本毕业论文格式模板，用于格式整理和学习支持，不代表任何学校官方模板。',
    educationLevel: 'UPGRADE_UNDERGRADUATE',
    thesisType: 'FULL_PAPER',
    sortOrder: 12,
  });
  await upsertTemplate({
    code: 'global-proposal-template',
    name: '通用开题报告模板',
    description: '通用开题报告阶段格式模板。',
    thesisType: 'PROPOSAL',
    stage: 'PROPOSAL',
    sortOrder: 20,
  });
  await upsertTemplate({
    code: 'global-outline-template',
    name: '通用论文大纲模板',
    description: '通用论文大纲阶段格式模板。',
    thesisType: 'OUTLINE',
    stage: 'OUTLINE',
    sortOrder: 30,
  });
  await upsertTemplate({
    code: 'global-course-paper-template',
    name: '通用课程论文模板',
    description: '通用课程论文格式模板，用于课程论文写作辅助和格式整理。',
    thesisType: 'COURSE_PAPER',
    sortOrder: 40,
  });
  await upsertTemplate({
    code: 'global-case-analysis-template',
    name: '通用案例分析模板',
    description: '通用案例分析格式模板，用于案例分析报告格式整理。',
    thesisType: 'CASE_ANALYSIS',
    sortOrder: 50,
  });

  const cqNormal = await prisma.academicSchool.findFirst({ where: { name: '重庆师范大学' }, select: { id: true } });
  if (cqNormal) {
    await upsertTemplate({
      code: 'demo-cqnu-undergraduate-template',
      name: '重庆师范大学本科论文示例模板（非官方）',
      description: '示例模板，仅用于演示学校维度模板匹配，不代表该校真实官方要求。',
      schoolId: cqNormal.id,
      templateType: ThesisFormatTemplateType.SCHOOL,
      educationLevel: 'UNDERGRADUATE',
      thesisType: 'FULL_PAPER',
      sortOrder: 5,
    });
  }

  console.log('[seed] thesis format templates upserted');
}

async function main() {
  const prisma = new PrismaClient();

  const phone = '13800000000';
  const email = 'admin@example.com';
  const password = await bcrypt.hash('Admin@123456', 10);

  const user = await prisma.user.upsert({
    where: { phone },
    update: {
      email,
      password,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      nickname: '超级管理员',
      totalWordsQuota: 99999999,
      registerChannel: 'seed',
    },
    create: {
      phone,
      email,
      password,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      nickname: '超级管理员',
      totalWordsQuota: 99999999,
      registerChannel: 'seed',
    },
    select: { id: true, phone: true, email: true, role: true },
  });

  console.log('[seed] created/updated super admin:', user);
  await seedAcademicData(prisma);
  await seedThesisSkills(prisma);
  await seedThesisFormatTemplates(prisma);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error('[seed] failed', error);
  process.exit(1);
});
