/*
  Warnings:

  - You are about to drop the column `isApproved` on the `Outline` table. All the data in the column will be lost.
  - You are about to drop the column `structure` on the `Outline` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[taskId]` on the table `Outline` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `targetWordCount` to the `Outline` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OutlineStatus" AS ENUM ('DRAFT', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OutlineNodeType" AS ENUM ('CHAPTER', 'SECTION', 'SUBSECTION', 'PARAGRAPH_HINT');

-- DropIndex
DROP INDEX "Outline_isApproved_idx";

-- DropIndex
DROP INDEX "Outline_taskId_version_key";

-- AlterTable
ALTER TABLE "Outline" DROP COLUMN "isApproved",
DROP COLUMN "structure",
ADD COLUMN     "generationDurationMs" INTEGER,
ADD COLUMN     "llmModel" TEXT,
ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "maxDepth" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "status" "OutlineStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "targetWordCount" INTEGER NOT NULL,
ADD COLUMN     "totalTokensUsed" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "totalWordCount" SET DEFAULT 0,
ALTER COLUMN "version" SET DEFAULT 1;

-- CreateTable
CREATE TABLE "OutlineNode" (
    "id" TEXT NOT NULL,
    "outlineId" TEXT NOT NULL,
    "parentId" TEXT,
    "nodeType" "OutlineNodeType" NOT NULL,
    "depth" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "expectedWords" INTEGER NOT NULL DEFAULT 0,
    "numbering" TEXT,
    "isLeaf" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutlineNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutlineNode_outlineId_parentId_orderIndex_idx" ON "OutlineNode"("outlineId", "parentId", "orderIndex");

-- CreateIndex
CREATE INDEX "OutlineNode_outlineId_depth_idx" ON "OutlineNode"("outlineId", "depth");

-- CreateIndex
CREATE UNIQUE INDEX "OutlineNode_outlineId_path_key" ON "OutlineNode"("outlineId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "Outline_taskId_key" ON "Outline"("taskId");

-- AddForeignKey
ALTER TABLE "OutlineNode" ADD CONSTRAINT "OutlineNode_outlineId_fkey" FOREIGN KEY ("outlineId") REFERENCES "Outline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutlineNode" ADD CONSTRAINT "OutlineNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OutlineNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
