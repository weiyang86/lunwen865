-- CreateEnum
CREATE TYPE "ThesisWordFileStatus" AS ENUM ('DRAFT', 'GENERATED', 'EDITING', 'FINALIZED', 'FAILED');
CREATE TYPE "ThesisWordFileVersionSourceType" AS ENUM ('GENERATED_FROM_DOCUMENT', 'ONLYOFFICE_EDITED', 'MANUAL_UPLOAD');

-- CreateTable
CREATE TABLE "ThesisDocumentFormatSetting" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "templateId" TEXT,
    "overrideRules" JSONB,
    "customRequirement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ThesisDocumentFormatSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThesisWordFile" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "ThesisWordFileStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ThesisWordFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThesisWordFileVersion" (
    "id" TEXT NOT NULL,
    "wordFileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "sourceType" "ThesisWordFileVersionSourceType" NOT NULL DEFAULT 'GENERATED_FROM_DOCUMENT',
    "sourceDocumentVersion" INTEGER,
    "formatTemplateId" TEXT,
    "formatSettingSnapshot" JSONB,
    "operatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThesisWordFileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ThesisDocumentFormatSetting_documentId_key" ON "ThesisDocumentFormatSetting"("documentId");
CREATE INDEX "ThesisDocumentFormatSetting_templateId_idx" ON "ThesisDocumentFormatSetting"("templateId");
CREATE UNIQUE INDEX "ThesisWordFile_documentId_key" ON "ThesisWordFile"("documentId");
CREATE INDEX "ThesisWordFile_taskId_idx" ON "ThesisWordFile"("taskId");
CREATE INDEX "ThesisWordFile_status_idx" ON "ThesisWordFile"("status");
CREATE UNIQUE INDEX "ThesisWordFileVersion_wordFileId_version_key" ON "ThesisWordFileVersion"("wordFileId", "version");
CREATE INDEX "ThesisWordFileVersion_formatTemplateId_idx" ON "ThesisWordFileVersion"("formatTemplateId");
CREATE INDEX "ThesisWordFileVersion_operatorId_idx" ON "ThesisWordFileVersion"("operatorId");
CREATE INDEX "ThesisWordFileVersion_createdAt_idx" ON "ThesisWordFileVersion"("createdAt");

-- AddForeignKey
ALTER TABLE "ThesisDocumentFormatSetting" ADD CONSTRAINT "ThesisDocumentFormatSetting_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ThesisDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisDocumentFormatSetting" ADD CONSTRAINT "ThesisDocumentFormatSetting_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ThesisFormatTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisWordFile" ADD CONSTRAINT "ThesisWordFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisWordFile" ADD CONSTRAINT "ThesisWordFile_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ThesisDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisWordFileVersion" ADD CONSTRAINT "ThesisWordFileVersion_wordFileId_fkey" FOREIGN KEY ("wordFileId") REFERENCES "ThesisWordFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisWordFileVersion" ADD CONSTRAINT "ThesisWordFileVersion_formatTemplateId_fkey" FOREIGN KEY ("formatTemplateId") REFERENCES "ThesisFormatTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisWordFileVersion" ADD CONSTRAINT "ThesisWordFileVersion_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
