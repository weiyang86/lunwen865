-- CreateEnum
CREATE TYPE "PromptStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PromptScene" AS ENUM ('PAPER_OUTLINE', 'PAPER_SECTION', 'PAPER_ABSTRACT', 'POLISH_ACADEMIC', 'POLISH_FLUENT', 'POLISH_TRANSLATE', 'EXPORT_TITLE', 'AI_CHAT', 'OTHER');

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "scene" "PromptScene" NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "model" VARCHAR(50),
    "temperature" DOUBLE PRECISION,
    "maxTokens" INTEGER,
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "model" VARCHAR(50),
    "temperature" DOUBLE PRECISION,
    "maxTokens" INTEGER,
    "changelog" VARCHAR(500),
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_code_key" ON "PromptTemplate"("code");

-- CreateIndex
CREATE INDEX "PromptTemplate_scene_status_idx" ON "PromptTemplate"("scene", "status");

-- CreateIndex
CREATE INDEX "PromptTemplate_code_idx" ON "PromptTemplate"("code");

-- CreateIndex
CREATE INDEX "PromptVersion_templateId_createdAt_idx" ON "PromptVersion"("templateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_templateId_version_key" ON "PromptVersion"("templateId", "version");

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PromptTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
