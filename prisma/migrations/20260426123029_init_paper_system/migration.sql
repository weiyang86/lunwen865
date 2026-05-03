/*
  Warnings:

  - The values [WAITING,GENERATED,REWRITTEN,ERROR] on the enum `ChapterStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [PENDING,RUNNING] on the enum `TaskStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `content` on the `Chapter` table. All the data in the column will be lost.
  - You are about to drop the column `revisionCount` on the `Chapter` table. All the data in the column will be lost.
  - You are about to drop the column `stageId` on the `Chapter` table. All the data in the column will be lost.
  - You are about to drop the column `advisorFeedback` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `metaJson` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `requirement` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `topic` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `wordCount` on the `Task` table. All the data in the column will be lost.
  - The `currentStage` column on the `Task` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Log` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Stage` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[taskId,index]` on the table `Chapter` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `targetWordCount` to the `Chapter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `taskId` to the `Chapter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `educationLevel` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `schoolId` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Made the column `major` on table `Task` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'WRITER', 'REVIEWER');

-- CreateEnum
CREATE TYPE "SchoolTemplateType" AS ENUM ('TOPIC', 'OPENING', 'THESIS');

-- CreateEnum
CREATE TYPE "TaskStage" AS ENUM ('TOPIC', 'OPENING', 'OUTLINE', 'WRITING', 'MERGING', 'FORMATTING', 'REVIEW', 'REVISION');

-- CreateEnum
CREATE TYPE "SectionStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED', 'REWRITING');

-- CreateEnum
CREATE TYPE "GenerationStage" AS ENUM ('TOPIC', 'OPENING', 'OUTLINE', 'CHAPTER', 'SECTION', 'SUMMARY');

-- CreateEnum
CREATE TYPE "LlmProvider" AS ENUM ('OPENAI', 'DEEPSEEK', 'QWEN');

-- AlterEnum
BEGIN;
CREATE TYPE "ChapterStatus_new" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED', 'REWRITING');
ALTER TABLE "public"."Chapter" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Chapter" ALTER COLUMN "status" TYPE "ChapterStatus_new" USING ("status"::text::"ChapterStatus_new");
ALTER TYPE "ChapterStatus" RENAME TO "ChapterStatus_old";
ALTER TYPE "ChapterStatus_new" RENAME TO "ChapterStatus";
DROP TYPE "public"."ChapterStatus_old";
ALTER TABLE "Chapter" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TaskStatus_new" AS ENUM ('INIT', 'TOPIC_GENERATING', 'TOPIC_PENDING_REVIEW', 'TOPIC_APPROVED', 'OPENING_GENERATING', 'OPENING_PENDING_REVIEW', 'OPENING_APPROVED', 'OUTLINE_GENERATING', 'OUTLINE_PENDING_REVIEW', 'OUTLINE_APPROVED', 'WRITING', 'WRITING_PAUSED', 'MERGING', 'FORMATTING', 'REVIEW', 'REVISION', 'DONE', 'FAILED', 'CANCELLED');
ALTER TABLE "public"."Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "TaskStatus_new" USING ("status"::text::"TaskStatus_new");
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
DROP TYPE "public"."TaskStatus_old";
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'INIT';
COMMIT;

-- DropForeignKey
ALTER TABLE "Chapter" DROP CONSTRAINT "Chapter_stageId_fkey";

-- DropForeignKey
ALTER TABLE "Log" DROP CONSTRAINT "Log_stageId_fkey";

-- DropForeignKey
ALTER TABLE "Log" DROP CONSTRAINT "Log_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Stage" DROP CONSTRAINT "Stage_taskId_fkey";

-- DropIndex
DROP INDEX "Chapter_index_idx";

-- DropIndex
DROP INDEX "Chapter_stageId_idx";

-- DropIndex
DROP INDEX "Task_createdAt_idx";

-- AlterTable
ALTER TABLE "Chapter" DROP COLUMN "content",
DROP COLUMN "revisionCount",
DROP COLUMN "stageId",
ADD COLUMN     "actualWordCount" INTEGER,
ADD COLUMN     "introduction" TEXT,
ADD COLUMN     "outlineId" TEXT,
ADD COLUMN     "targetWordCount" INTEGER NOT NULL,
ADD COLUMN     "taskId" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "advisorFeedback",
DROP COLUMN "metaJson",
DROP COLUMN "requirement",
DROP COLUMN "topic",
DROP COLUMN "type",
DROP COLUMN "wordCount",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "educationLevel" TEXT NOT NULL,
ADD COLUMN     "requirements" TEXT,
ADD COLUMN     "schoolId" TEXT NOT NULL,
ADD COLUMN     "totalWordCount" INTEGER,
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "major" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'INIT',
DROP COLUMN "currentStage",
ADD COLUMN     "currentStage" "TaskStage" DEFAULT 'TOPIC';

-- DropTable
DROP TABLE "Log";

-- DropTable
DROP TABLE "Stage";

-- DropEnum
DROP TYPE "StageStatus";

-- DropEnum
DROP TYPE "StageType";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'WRITER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "templateType" "SchoolTemplateType" NOT NULL,
    "formatConfig" JSONB NOT NULL,
    "docxTemplateUrl" TEXT,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicCandidate" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningReport" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "reviewComments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outline" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "structure" JSONB NOT NULL,
    "totalWordCount" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "targetWordCount" INTEGER NOT NULL,
    "actualWordCount" INTEGER,
    "corePoints" JSONB,
    "content" TEXT,
    "status" "SectionStatus" NOT NULL DEFAULT 'PENDING',
    "similarityScore" DECIMAL(5,2),
    "regenerateCount" INTEGER NOT NULL DEFAULT 0,
    "previousSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperMemory" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "keywords" TEXT[],
    "chapterSummaries" JSONB NOT NULL,
    "globalContext" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "stage" "GenerationStage" NOT NULL,
    "targetId" TEXT,
    "provider" "LlmProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "cost" DECIMAL(10,6) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolTemplate_activeKey_key" ON "SchoolTemplate"("activeKey");

-- CreateIndex
CREATE INDEX "SchoolTemplate_schoolId_idx" ON "SchoolTemplate"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolTemplate_templateType_idx" ON "SchoolTemplate"("templateType");

-- CreateIndex
CREATE INDEX "SchoolTemplate_isActive_idx" ON "SchoolTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolTemplate_schoolId_templateType_version_key" ON "SchoolTemplate"("schoolId", "templateType", "version");

-- CreateIndex
CREATE INDEX "TopicCandidate_taskId_idx" ON "TopicCandidate"("taskId");

-- CreateIndex
CREATE INDEX "TopicCandidate_isSelected_idx" ON "TopicCandidate"("isSelected");

-- CreateIndex
CREATE INDEX "OpeningReport_taskId_idx" ON "OpeningReport"("taskId");

-- CreateIndex
CREATE INDEX "OpeningReport_isApproved_idx" ON "OpeningReport"("isApproved");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningReport_taskId_version_key" ON "OpeningReport"("taskId", "version");

-- CreateIndex
CREATE INDEX "Outline_taskId_idx" ON "Outline"("taskId");

-- CreateIndex
CREATE INDEX "Outline_isApproved_idx" ON "Outline"("isApproved");

-- CreateIndex
CREATE UNIQUE INDEX "Outline_taskId_version_key" ON "Outline"("taskId", "version");

-- CreateIndex
CREATE INDEX "Section_chapterId_idx" ON "Section"("chapterId");

-- CreateIndex
CREATE INDEX "Section_status_idx" ON "Section"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Section_chapterId_index_key" ON "Section"("chapterId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "PaperMemory_taskId_key" ON "PaperMemory"("taskId");

-- CreateIndex
CREATE INDEX "GenerationLog_taskId_idx" ON "GenerationLog"("taskId");

-- CreateIndex
CREATE INDEX "GenerationLog_createdAt_idx" ON "GenerationLog"("createdAt");

-- CreateIndex
CREATE INDEX "GenerationLog_stage_idx" ON "GenerationLog"("stage");

-- CreateIndex
CREATE INDEX "GenerationLog_targetId_idx" ON "GenerationLog"("targetId");

-- CreateIndex
CREATE INDEX "Chapter_taskId_idx" ON "Chapter"("taskId");

-- CreateIndex
CREATE INDEX "Chapter_outlineId_idx" ON "Chapter"("outlineId");

-- CreateIndex
CREATE INDEX "Chapter_status_idx" ON "Chapter"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_taskId_index_key" ON "Chapter"("taskId", "index");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE INDEX "Task_schoolId_idx" ON "Task"("schoolId");

-- AddForeignKey
ALTER TABLE "SchoolTemplate" ADD CONSTRAINT "SchoolTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicCandidate" ADD CONSTRAINT "TopicCandidate_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningReport" ADD CONSTRAINT "OpeningReport_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outline" ADD CONSTRAINT "Outline_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_outlineId_fkey" FOREIGN KEY ("outlineId") REFERENCES "Outline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperMemory" ADD CONSTRAINT "PaperMemory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationLog" ADD CONSTRAINT "GenerationLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
