-- CreateEnum
CREATE TYPE "OpeningReportStatus" AS ENUM ('PENDING', 'GENERATING', 'PARTIAL', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OpeningReportSectionStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "OpeningReport" ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "fullContent" TEXT,
ADD COLUMN     "generationEndedAt" TIMESTAMP(3),
ADD COLUMN     "generationStartedAt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "OpeningReportStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "totalWordCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "OpeningReportSection" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "sectionTitle" TEXT NOT NULL,
    "sectionIndex" INTEGER NOT NULL,
    "status" "OpeningReportSectionStatus" NOT NULL DEFAULT 'PENDING',
    "content" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "generatedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningReportSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpeningReportSection_reportId_idx" ON "OpeningReportSection"("reportId");

-- CreateIndex
CREATE INDEX "OpeningReportSection_status_idx" ON "OpeningReportSection"("status");

-- CreateIndex
CREATE INDEX "OpeningReportSection_reportId_sectionIndex_idx" ON "OpeningReportSection"("reportId", "sectionIndex");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningReportSection_reportId_sectionKey_key" ON "OpeningReportSection"("reportId", "sectionKey");

-- AddForeignKey
ALTER TABLE "OpeningReportSection" ADD CONSTRAINT "OpeningReportSection_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "OpeningReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
