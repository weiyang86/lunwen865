-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'RUNNING', 'REVIEW', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('OUTLINE', 'PROPOSAL', 'CHAPTER', 'REVISION', 'REDUCE', 'AIGC_REWRITE', 'EXPORT');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('WAITING', 'PROCESSING', 'SUCCESS', 'ERROR');

-- CreateEnum
CREATE TYPE "ChapterStatus" AS ENUM ('WAITING', 'GENERATED', 'REWRITTEN', 'ERROR');

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "major" TEXT,
    "wordCount" INTEGER,
    "requirement" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "currentStage" "StageType",
    "advisorFeedback" JSONB,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" "StageType" NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "StageStatus" NOT NULL DEFAULT 'WAITING',
    "inputJson" JSONB,
    "outputJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ChapterStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "stageId" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");

-- CreateIndex
CREATE INDEX "Stage_taskId_idx" ON "Stage"("taskId");

-- CreateIndex
CREATE INDEX "Stage_type_idx" ON "Stage"("type");

-- CreateIndex
CREATE INDEX "Stage_status_idx" ON "Stage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_taskId_type_version_key" ON "Stage"("taskId", "type", "version");

-- CreateIndex
CREATE INDEX "Chapter_stageId_idx" ON "Chapter"("stageId");

-- CreateIndex
CREATE INDEX "Chapter_index_idx" ON "Chapter"("index");

-- CreateIndex
CREATE INDEX "Log_taskId_idx" ON "Log"("taskId");

-- CreateIndex
CREATE INDEX "Log_stageId_idx" ON "Log"("stageId");

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
