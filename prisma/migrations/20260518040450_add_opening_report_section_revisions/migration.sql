-- CreateEnum
CREATE TYPE "OpeningReportSectionRevisionType" AS ENUM ('ADVISOR_REWRITE', 'MANUAL_EDIT');

-- CreateTable
CREATE TABLE "OpeningReportSectionRevision" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "type" "OpeningReportSectionRevisionType" NOT NULL,
    "feedback" TEXT,
    "beforeContent" TEXT,
    "afterContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpeningReportSectionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpeningReportSectionRevision_sectionId_idx" ON "OpeningReportSectionRevision"("sectionId");

-- CreateIndex
CREATE INDEX "OpeningReportSectionRevision_type_idx" ON "OpeningReportSectionRevision"("type");

-- CreateIndex
CREATE INDEX "OpeningReportSectionRevision_createdAt_idx" ON "OpeningReportSectionRevision"("createdAt");

-- AddForeignKey
ALTER TABLE "OpeningReportSectionRevision" ADD CONSTRAINT "OpeningReportSectionRevision_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "OpeningReportSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
