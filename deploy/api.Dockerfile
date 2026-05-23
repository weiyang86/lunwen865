FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
ENV DATABASE_URL="postgresql://thesis:thesis@postgres:5432/thesis_db"
COPY . .
RUN pnpm --filter api exec prisma generate --schema=/app/prisma/schema.prisma
RUN pnpm --filter api build

FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/prisma ./prisma
COPY pnpm-workspace.yaml package.json ./
EXPOSE 3001
CMD ["sh", "-c", "pnpm --filter api start:prod"]
