-- CreateEnum
CREATE TYPE "ThesisFormatTemplateStatus" AS ENUM ('ENABLED', 'DISABLED');
CREATE TYPE "ThesisFormatTemplateType" AS ENUM ('GENERAL', 'SCHOOL', 'COLLEGE', 'MAJOR', 'CUSTOM');
CREATE TYPE "ThesisFormatRuleType" AS ENUM ('PAGE', 'TITLE', 'BODY', 'HEADING', 'ABSTRACT', 'KEYWORDS', 'TOC', 'REFERENCE', 'COVER', 'FOOTER', 'HEADER', 'CUSTOM');
CREATE TYPE "ThesisExportFormat" AS ENUM ('DOCX', 'PDF');
CREATE TYPE "ThesisExportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ThesisFormatTemplate" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "schoolId" TEXT,
    "collegeId" TEXT,
    "majorId" TEXT,
    "educationLevel" VARCHAR(40),
    "thesisType" VARCHAR(60),
    "stage" VARCHAR(40),
    "templateType" "ThesisFormatTemplateType" NOT NULL DEFAULT 'GENERAL',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "ThesisFormatTemplateStatus" NOT NULL DEFAULT 'ENABLED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ThesisFormatTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThesisFormatRule" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "ruleType" "ThesisFormatRuleType" NOT NULL,
    "ruleKey" VARCHAR(80) NOT NULL,
    "ruleValue" JSONB NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ThesisFormatRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThesisExportJob" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exportStage" VARCHAR(40) NOT NULL,
    "exportFormat" "ThesisExportFormat" NOT NULL DEFAULT 'DOCX',
    "customRequirement" TEXT,
    "status" "ThesisExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "fileUrl" TEXT,
    "fileName" VARCHAR(255),
    "fileSize" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ThesisExportJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThesisExportFile" (
    "id" TEXT NOT NULL,
    "exportJobId" TEXT NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" "ThesisExportFormat" NOT NULL,
    "fileSize" INTEGER,
    "storageProvider" VARCHAR(40) NOT NULL DEFAULT 'local',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThesisExportFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ThesisFormatTemplate_code_key" ON "ThesisFormatTemplate"("code");
CREATE INDEX "ThesisFormatTemplate_status_isDefault_sortOrder_idx" ON "ThesisFormatTemplate"("status", "isDefault", "sortOrder");
CREATE INDEX "ThesisFormatTemplate_schoolId_idx" ON "ThesisFormatTemplate"("schoolId");
CREATE INDEX "ThesisFormatTemplate_collegeId_idx" ON "ThesisFormatTemplate"("collegeId");
CREATE INDEX "ThesisFormatTemplate_majorId_idx" ON "ThesisFormatTemplate"("majorId");
CREATE INDEX "ThesisFormatTemplate_educationLevel_idx" ON "ThesisFormatTemplate"("educationLevel");
CREATE INDEX "ThesisFormatTemplate_thesisType_idx" ON "ThesisFormatTemplate"("thesisType");
CREATE INDEX "ThesisFormatTemplate_stage_idx" ON "ThesisFormatTemplate"("stage");
CREATE UNIQUE INDEX "ThesisFormatRule_templateId_ruleKey_key" ON "ThesisFormatRule"("templateId", "ruleKey");
CREATE INDEX "ThesisFormatRule_templateId_ruleType_sortOrder_idx" ON "ThesisFormatRule"("templateId", "ruleType", "sortOrder");
CREATE INDEX "ThesisExportJob_taskId_createdAt_idx" ON "ThesisExportJob"("taskId", "createdAt");
CREATE INDEX "ThesisExportJob_documentId_idx" ON "ThesisExportJob"("documentId");
CREATE INDEX "ThesisExportJob_templateId_idx" ON "ThesisExportJob"("templateId");
CREATE INDEX "ThesisExportJob_userId_createdAt_idx" ON "ThesisExportJob"("userId", "createdAt");
CREATE INDEX "ThesisExportJob_status_createdAt_idx" ON "ThesisExportJob"("status", "createdAt");
CREATE INDEX "ThesisExportJob_exportStage_idx" ON "ThesisExportJob"("exportStage");
CREATE INDEX "ThesisExportFile_exportJobId_idx" ON "ThesisExportFile"("exportJobId");
CREATE INDEX "ThesisExportFile_fileType_idx" ON "ThesisExportFile"("fileType");

-- AddForeignKey
ALTER TABLE "ThesisFormatTemplate" ADD CONSTRAINT "ThesisFormatTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "AcademicSchool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisFormatTemplate" ADD CONSTRAINT "ThesisFormatTemplate_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "AcademicCollege"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisFormatTemplate" ADD CONSTRAINT "ThesisFormatTemplate_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "AcademicMajor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThesisFormatRule" ADD CONSTRAINT "ThesisFormatRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ThesisFormatTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisExportJob" ADD CONSTRAINT "ThesisExportJob_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisExportJob" ADD CONSTRAINT "ThesisExportJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ThesisDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisExportJob" ADD CONSTRAINT "ThesisExportJob_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ThesisFormatTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ThesisExportJob" ADD CONSTRAINT "ThesisExportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisExportFile" ADD CONSTRAINT "ThesisExportFile_exportJobId_fkey" FOREIGN KEY ("exportJobId") REFERENCES "ThesisExportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
