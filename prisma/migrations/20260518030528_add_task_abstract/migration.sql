-- CreateEnum
CREATE TYPE "AbstractStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "TaskStage" ADD VALUE 'ABSTRACT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskStatus" ADD VALUE 'ABSTRACT_GENERATING';
ALTER TYPE "TaskStatus" ADD VALUE 'ABSTRACT_PENDING_REVIEW';
ALTER TYPE "TaskStatus" ADD VALUE 'ABSTRACT_APPROVED';

-- CreateTable
CREATE TABLE "TaskAbstract" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "AbstractStatus" NOT NULL DEFAULT 'PENDING',
    "abstractZh" TEXT,
    "abstractEn" TEXT,
    "feedback" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "llmModel" TEXT,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAbstract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskAbstract_taskId_idx" ON "TaskAbstract"("taskId");

-- CreateIndex
CREATE INDEX "TaskAbstract_status_idx" ON "TaskAbstract"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAbstract_taskId_version_key" ON "TaskAbstract"("taskId", "version");

-- CreateIndex
CREATE INDEX "SystemSetting_key_idx" ON "SystemSetting"("key");

-- AddForeignKey
ALTER TABLE "TaskAbstract" ADD CONSTRAINT "TaskAbstract_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
