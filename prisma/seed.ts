import { AcademicStatus, PrismaClient, UserRole, UserStatus } from '@prisma/client';
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
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error('[seed] failed', error);
  process.exit(1);
});
