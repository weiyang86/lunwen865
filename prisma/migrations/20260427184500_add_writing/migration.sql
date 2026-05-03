-- CreateEnum
CREATE TYPE "WritingSessionStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WritingSectionStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WritingSession" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "outlineSnapshotId" TEXT,
    "status" "WritingSessionStatus" NOT NULL DEFAULT 'PENDING',
    "totalSections" INTEGER NOT NULL,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "currentSectionId" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WritingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingSection" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "outlineNodeId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "expectedWords" INTEGER NOT NULL DEFAULT 0,
    "status" "WritingSectionStatus" NOT NULL DEFAULT 'PENDING',
    "rawContent" TEXT,
    "editedContent" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "refKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WritingSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WritingSession_taskId_idx" ON "WritingSession"("taskId");

-- CreateIndex
CREATE INDEX "WritingSession_status_idx" ON "WritingSession"("status");

-- CreateIndex
CREATE INDEX "WritingSession_taskId_status_createdAt_idx" ON "WritingSession"("taskId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WritingSection_sessionId_orderIndex_key" ON "WritingSection"("sessionId", "orderIndex");

-- CreateIndex
CREATE INDEX "WritingSection_sessionId_status_orderIndex_idx" ON "WritingSection"("sessionId", "status", "orderIndex");

-- CreateIndex
CREATE INDEX "WritingSection_outlineNodeId_idx" ON "WritingSection"("outlineNodeId");

-- AddForeignKey
ALTER TABLE "WritingSession" ADD CONSTRAINT "WritingSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSession" ADD CONSTRAINT "WritingSession_outlineSnapshotId_fkey" FOREIGN KEY ("outlineSnapshotId") REFERENCES "Outline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSection" ADD CONSTRAINT "WritingSection_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WritingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSection" ADD CONSTRAINT "WritingSection_outlineNodeId_fkey" FOREIGN KEY ("outlineNodeId") REFERENCES "OutlineNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

