Project Context:
Backend:
- NestJS 11
- Prisma 6.19
- PostgreSQL (Docker)
- pnpm monorepo

Architecture:
- Modular architecture
- PrismaModule exports PrismaService
- Other modules import PrismaModule
- Using DTO and class-validator
- ValidationPipe enabled globally

Database:
(schema.prisma content here)

Rules:
- Do not change existing architecture
- Do not create duplicate PrismaService
- Follow Nest best practices
- Use DTO validation
- Keep code clean and production-ready

Goal:
(Describe your feature clearly here)