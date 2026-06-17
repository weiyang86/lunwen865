-- CreateEnum
CREATE TYPE "ThesisDocumentStatus" AS ENUM ('DRAFT', 'EDITING', 'REVIEWING', 'FINALIZED');
CREATE TYPE "ThesisDocumentSectionType" AS ENUM ('TITLE', 'ABSTRACT', 'KEYWORDS', 'CHAPTER', 'SECTION', 'REFERENCE', 'ACKNOWLEDGEMENT', 'APPENDIX');
CREATE TYPE "ThesisAdvisorCommentStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');
CREATE TYPE "ThesisDocumentMergeMode" AS ENUM ('APPEND', 'REPLACE_SECTION', 'SMART_MERGE');

-- CreateTable
CREATE TABLE "ThesisDocument" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "abstract" TEXT,
    "keywords" JSONB,
    "status" "ThesisDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ThesisDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThesisDocumentSection" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "parentId" TEXT,
    "sectionType" "ThesisDocumentSectionType" NOT NULL DEFAULT 'SECTION',
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT,
    "plainText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "sourceStage" VARCHAR(40),
    "sourceGenerationRunId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ThesisDocumentSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThesisDocumentRevision" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sectionId" TEXT,
    "version" INTEGER NOT NULL,
    "beforeContent" TEXT,
    "afterContent" TEXT,
    "changeSummary" TEXT,
    "operatorId" TEXT,
    "operatorRole" VARCHAR(40),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThesisDocumentRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThesisAdvisorComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sectionId" TEXT,
    "commentText" TEXT NOT NULL,
    "status" "ThesisAdvisorCommentStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ThesisAdvisorComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ThesisDocument_taskId_key" ON "ThesisDocument"("taskId");
CREATE INDEX "ThesisDocument_taskId_idx" ON "ThesisDocument"("taskId");
CREATE INDEX "ThesisDocument_status_idx" ON "ThesisDocument"("status");
CREATE INDEX "ThesisDocument_updatedAt_idx" ON "ThesisDocument"("updatedAt");
CREATE INDEX "ThesisDocumentSection_documentId_parentId_sortOrder_idx" ON "ThesisDocumentSection"("documentId", "parentId", "sortOrder");
CREATE INDEX "ThesisDocumentSection_documentId_deletedAt_idx" ON "ThesisDocumentSection"("documentId", "deletedAt");
CREATE INDEX "ThesisDocumentSection_sourceStage_idx" ON "ThesisDocumentSection"("sourceStage");
CREATE INDEX "ThesisDocumentSection_sourceGenerationRunId_idx" ON "ThesisDocumentSection"("sourceGenerationRunId");
CREATE INDEX "ThesisDocumentRevision_documentId_createdAt_idx" ON "ThesisDocumentRevision"("documentId", "createdAt");
CREATE INDEX "ThesisDocumentRevision_sectionId_createdAt_idx" ON "ThesisDocumentRevision"("sectionId", "createdAt");
CREATE INDEX "ThesisDocumentRevision_operatorId_idx" ON "ThesisDocumentRevision"("operatorId");
CREATE INDEX "ThesisAdvisorComment_taskId_status_idx" ON "ThesisAdvisorComment"("taskId", "status");
CREATE INDEX "ThesisAdvisorComment_documentId_status_idx" ON "ThesisAdvisorComment"("documentId", "status");
CREATE INDEX "ThesisAdvisorComment_sectionId_idx" ON "ThesisAdvisorComment"("sectionId");
CREATE INDEX "ThesisAdvisorComment_createdAt_idx" ON "ThesisAdvisorComment"("createdAt");

-- AddForeignKey
ALTER TABLE "ThesisDocument" ADD CONSTRAINT "ThesisDocument_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisDocumentSection" ADD CONSTRAINT "ThesisDocumentSection_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ThesisDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisDocumentSection" ADD CONSTRAINT "ThesisDocumentSection_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ThesisDocumentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisDocumentRevision" ADD CONSTRAINT "ThesisDocumentRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ThesisDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisDocumentRevision" ADD CONSTRAINT "ThesisDocumentRevision_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ThesisDocumentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisDocumentRevision" ADD CONSTRAINT "ThesisDocumentRevision_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisAdvisorComment" ADD CONSTRAINT "ThesisAdvisorComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisAdvisorComment" ADD CONSTRAINT "ThesisAdvisorComment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ThesisDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisAdvisorComment" ADD CONSTRAINT "ThesisAdvisorComment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ThesisDocumentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
