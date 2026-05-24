FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /app


FROM base AS deps

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --frozen-lockfile


FROM deps AS build

COPY . .

RUN pnpm prisma generate --schema=prisma/schema.prisma

RUN pnpm --filter api build


FROM base AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# 复制 pnpm 真实依赖仓库
COPY --from=build /app/node_modules ./node_modules

# 关键：复制 api 工作区的 node_modules 软链接目录
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules

# 复制构建产物
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json

# 复制 Prisma 文件，用于 migrate deploy
COPY --from=build /app/prisma ./prisma

# 复制 workspace 配置
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/package.json ./package.json

EXPOSE 3001

CMD ["sh", "-c", "pnpm prisma migrate deploy --schema=prisma/schema.prisma && pnpm --filter api start:prod"]