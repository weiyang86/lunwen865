import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaskService {
  constructor(private prisma: PrismaService) {}

  async createTest() {
    const now = Date.now();

    const user = await this.prisma.user.create({
      data: {
        nickname: `user_${now}`,
        email: `user_${now}@example.com`,
        password: 'hashed_password_placeholder',
        role: 'USER',
      },
      select: { id: true },
    });

    const school = await this.prisma.school.create({
      data: {
        name: '测试大学',
        code: `TEST_${now}`,
        description: '用于联调的测试学校',
      },
      select: { id: true },
    });

    return this.prisma.task.create({
      data: {
        userId: user.id,
        schoolId: school.id,
        major: '计算机科学与技术',
        educationLevel: '成人本科',
        title: '基于大模型的论文自动生产系统设计与实现',
        requirements: '用于联调与功能验证的测试任务',
        totalWordCount: 8000,
      },
    });
  }

  async findAll() {
    return this.prisma.task.findMany();
  }
}
