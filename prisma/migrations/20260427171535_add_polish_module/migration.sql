-- CreateEnum
CREATE TYPE "PolishStrength" AS ENUM ('LIGHT', 'MEDIUM', 'STRONG');

-- CreateEnum
CREATE TYPE "PolishMode" AS ENUM ('CONSERVATIVE', 'BALANCED', 'AGGRESSIVE');

-- CreateEnum
CREATE TYPE "PolishStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PolishTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT,
    "originalText" TEXT NOT NULL,
    "polishedText" TEXT,
    "originalLength" INTEGER NOT NULL,
    "polishedLength" INTEGER,
    "strength" "PolishStrength" NOT NULL,
    "mode" "PolishMode" NOT NULL,
    "preserveQuotes" BOOLEAN NOT NULL DEFAULT true,
    "preserveTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PolishStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "aiScoreBefore" DOUBLE PRECISION,
    "aiScoreAfter" DOUBLE PRECISION,
    "modelUsed" TEXT,
    "tokensConsumed" INTEGER,
    "wordsCharged" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolishTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolishSegment" (
    "id" TEXT NOT NULL,
    "polishTaskId" TEXT NOT NULL,
    "segmentIndex" INTEGER NOT NULL,
    "originalText" TEXT NOT NULL,
    "polishedText" TEXT,
    "status" "PolishStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "tokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolishSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolishTask_userId_status_idx" ON "PolishTask"("userId", "status");

-- CreateIndex
CREATE INDEX "PolishTask_taskId_idx" ON "PolishTask"("taskId");

-- CreateIndex
CREATE INDEX "PolishTask_createdAt_idx" ON "PolishTask"("createdAt");

-- CreateIndex
CREATE INDEX "PolishSegment_polishTaskId_segmentIndex_idx" ON "PolishSegment"("polishTaskId", "segmentIndex");

-- AddForeignKey
ALTER TABLE "PolishTask" ADD CONSTRAINT "PolishTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolishTask" ADD CONSTRAINT "PolishTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolishSegment" ADD CONSTRAINT "PolishSegment_polishTaskId_fkey" FOREIGN KEY ("polishTaskId") REFERENCES "PolishTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
