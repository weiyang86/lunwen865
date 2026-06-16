-- Workbench-Format-01: save the current format template and local overrides for a thesis document.
CREATE TABLE "ThesisDocumentFormatSetting" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "templateId" TEXT,
    "overrideRules" JSONB,
    "customRequirement" TEXT,
    "previewMode" VARCHAR(40) DEFAULT 'SIMPLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThesisDocumentFormatSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ThesisDocumentFormatSetting_documentId_key" ON "ThesisDocumentFormatSetting"("documentId");
CREATE INDEX "ThesisDocumentFormatSetting_templateId_idx" ON "ThesisDocumentFormatSetting"("templateId");
CREATE INDEX "ThesisDocumentFormatSetting_updatedAt_idx" ON "ThesisDocumentFormatSetting"("updatedAt");

ALTER TABLE "ThesisDocumentFormatSetting" ADD CONSTRAINT "ThesisDocumentFormatSetting_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ThesisDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisDocumentFormatSetting" ADD CONSTRAINT "ThesisDocumentFormatSetting_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ThesisFormatTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
