-- CreateEnum
CREATE TYPE "ThesisSkillStage" AS ENUM ('TOPIC', 'PROPOSAL', 'OUTLINE', 'FULL_PAPER', 'REVISION', 'POLISHING', 'FORMAT_CHECK', 'REFERENCE', 'ABSTRACT', 'DEFENSE');

-- CreateEnum
CREATE TYPE "ThesisSkillCategory" AS ENUM ('GENERATION', 'REVISION', 'CHECK', 'EXPORT_ASSIST');

-- CreateEnum
CREATE TYPE "ThesisSkillStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ThesisSkillRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "ThesisSkill" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "stage" "ThesisSkillStage" NOT NULL,
    "category" "ThesisSkillCategory" NOT NULL,
    "status" "ThesisSkillStatus" NOT NULL DEFAULT 'ENABLED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThesisSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThesisSkillVersion" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "inputSchema" JSONB NOT NULL,
    "outputSchema" JSONB NOT NULL,
    "qualityRules" JSONB NOT NULL,
    "modelConfig" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activeKey" TEXT,
    "changeLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThesisSkillVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThesisSkillBinding" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "skillVersionId" TEXT,
    "educationLevel" VARCHAR(40),
    "thesisType" VARCHAR(60),
    "disciplineCategoryId" TEXT,
    "disciplineLevelOneId" TEXT,
    "disciplineLevelTwoId" TEXT,
    "schoolId" TEXT,
    "majorId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "ThesisSkillStatus" NOT NULL DEFAULT 'ENABLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThesisSkillBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThesisSkillRun" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "skillVersionId" TEXT NOT NULL,
    "bindingId" TEXT,
    "taskId" TEXT,
    "stage" "ThesisSkillStage" NOT NULL,
    "inputPayload" JSONB NOT NULL,
    "outputPayload" JSONB,
    "qualityResult" JSONB,
    "modelName" VARCHAR(100),
    "tokenUsage" JSONB,
    "status" "ThesisSkillRunStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThesisSkillRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ThesisSkill_code_key" ON "ThesisSkill"("code");
CREATE INDEX "ThesisSkill_stage_status_sortOrder_idx" ON "ThesisSkill"("stage", "status", "sortOrder");
CREATE INDEX "ThesisSkill_category_idx" ON "ThesisSkill"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ThesisSkillVersion_activeKey_key" ON "ThesisSkillVersion"("activeKey");
CREATE UNIQUE INDEX "ThesisSkillVersion_skillId_version_key" ON "ThesisSkillVersion"("skillId", "version");
CREATE INDEX "ThesisSkillVersion_skillId_isActive_idx" ON "ThesisSkillVersion"("skillId", "isActive");

-- CreateIndex
CREATE INDEX "ThesisSkillBinding_skillId_status_priority_idx" ON "ThesisSkillBinding"("skillId", "status", "priority");
CREATE INDEX "ThesisSkillBinding_skillVersionId_idx" ON "ThesisSkillBinding"("skillVersionId");
CREATE INDEX "ThesisSkillBinding_schoolId_idx" ON "ThesisSkillBinding"("schoolId");
CREATE INDEX "ThesisSkillBinding_majorId_idx" ON "ThesisSkillBinding"("majorId");
CREATE INDEX "ThesisSkillBinding_disciplineCategoryId_idx" ON "ThesisSkillBinding"("disciplineCategoryId");
CREATE INDEX "ThesisSkillBinding_disciplineLevelOneId_idx" ON "ThesisSkillBinding"("disciplineLevelOneId");
CREATE INDEX "ThesisSkillBinding_disciplineLevelTwoId_idx" ON "ThesisSkillBinding"("disciplineLevelTwoId");

-- CreateIndex
CREATE INDEX "ThesisSkillRun_skillId_createdAt_idx" ON "ThesisSkillRun"("skillId", "createdAt");
CREATE INDEX "ThesisSkillRun_skillVersionId_idx" ON "ThesisSkillRun"("skillVersionId");
CREATE INDEX "ThesisSkillRun_bindingId_idx" ON "ThesisSkillRun"("bindingId");
CREATE INDEX "ThesisSkillRun_taskId_idx" ON "ThesisSkillRun"("taskId");
CREATE INDEX "ThesisSkillRun_stage_status_createdAt_idx" ON "ThesisSkillRun"("stage", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ThesisSkillVersion" ADD CONSTRAINT "ThesisSkillVersion_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "ThesisSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisSkillBinding" ADD CONSTRAINT "ThesisSkillBinding_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "ThesisSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisSkillBinding" ADD CONSTRAINT "ThesisSkillBinding_skillVersionId_fkey" FOREIGN KEY ("skillVersionId") REFERENCES "ThesisSkillVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisSkillBinding" ADD CONSTRAINT "ThesisSkillBinding_disciplineCategoryId_fkey" FOREIGN KEY ("disciplineCategoryId") REFERENCES "DisciplineCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisSkillBinding" ADD CONSTRAINT "ThesisSkillBinding_disciplineLevelOneId_fkey" FOREIGN KEY ("disciplineLevelOneId") REFERENCES "DisciplineLevelOne"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisSkillBinding" ADD CONSTRAINT "ThesisSkillBinding_disciplineLevelTwoId_fkey" FOREIGN KEY ("disciplineLevelTwoId") REFERENCES "DisciplineLevelTwo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisSkillBinding" ADD CONSTRAINT "ThesisSkillBinding_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "AcademicSchool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisSkillBinding" ADD CONSTRAINT "ThesisSkillBinding_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "AcademicMajor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisSkillRun" ADD CONSTRAINT "ThesisSkillRun_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "ThesisSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisSkillRun" ADD CONSTRAINT "ThesisSkillRun_skillVersionId_fkey" FOREIGN KEY ("skillVersionId") REFERENCES "ThesisSkillVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ThesisSkillRun" ADD CONSTRAINT "ThesisSkillRun_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "ThesisSkillBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisSkillRun" ADD CONSTRAINT "ThesisSkillRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
