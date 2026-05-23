FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /app


FROM base AS deps

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --frozen-lockfile


FROM deps AS build

COPY . .

# 关键：先生成 Prisma Client，再构建 NestJS
# 这一步只需要 schema.prisma，不需要连接数据库
RUN pnpm prisma generate --schema=prisma/schema.prisma

RUN pnpm --filter api build


FROM base AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# 必须从 build 阶段复制 node_modules
# 因为 Prisma Client 是在 build 阶段 generate 出来的
COPY --from=build /app/node_modules ./node_modules

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json

# runtime 阶段保留 prisma 目录，用于 migrate deploy
COPY --from=build /app/prisma ./prisma

COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/package.json ./package.json

EXPOSE 3001

# 启动容器时先执行数据库迁移，再启动 NestJS
CMD ["sh", "-c", "pnpm prisma migrate deploy --schema=prisma/schema.prisma && pnpm --filter api start:prod"]