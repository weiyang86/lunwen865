import { AcademicStatus, PrismaClient, ThesisSkillCategory, ThesisSkillStage, ThesisSkillStatus, UserRole, UserStatus } from '@prisma/client';
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
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error('[seed] failed', error);
  process.exit(1);
});
