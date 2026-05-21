-- CreateEnum
CREATE TYPE "TaskAbstractRevisionType" AS ENUM ('GENERATE', 'REWRITE', 'MANUAL_EDIT');

-- CreateTable
CREATE TABLE "TaskAbstractRevision" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "abstractId" TEXT,
    "type" "TaskAbstractRevisionType" NOT NULL,
    "feedback" TEXT,
    "fromVersion" INTEGER,
    "toVersion" INTEGER,
    "beforeZh" TEXT,
    "beforeEn" TEXT,
    "afterZh" TEXT,
    "afterEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAbstractRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskAbstractRevision_taskId_idx" ON "TaskAbstractRevision"("taskId");

-- CreateIndex
CREATE INDEX "TaskAbstractRevision_abstractId_idx" ON "TaskAbstractRevision"("abstractId");

-- CreateIndex
CREATE INDEX "TaskAbstractRevision_type_idx" ON "TaskAbstractRevision"("type");

-- CreateIndex
CREATE INDEX "TaskAbstractRevision_createdAt_idx" ON "TaskAbstractRevision"("createdAt");

-- AddForeignKey
ALTER TABLE "TaskAbstractRevision" ADD CONSTRAINT "TaskAbstractRevision_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAbstractRevision" ADD CONSTRAINT "TaskAbstractRevision_abstractId_fkey" FOREIGN KEY ("abstractId") REFERENCES "TaskAbstract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
