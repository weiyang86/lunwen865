-- OnlyOffice-01: add online editing metadata and callback version trace fields.
ALTER TABLE "ThesisWordFile"
  ADD COLUMN IF NOT EXISTS "editingSessionKey" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastEditedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "lockStatus" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "onlyofficeDocumentKey" VARCHAR(255);

ALTER TABLE "ThesisWordFileVersion"
  ADD COLUMN IF NOT EXISTS "editorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "callbackPayload" JSONB,
  ADD COLUMN IF NOT EXISTS "checksum" VARCHAR(128);

CREATE INDEX IF NOT EXISTS "ThesisWordFile_lastEditedBy_idx" ON "ThesisWordFile"("lastEditedBy");
CREATE INDEX IF NOT EXISTS "ThesisWordFile_onlyofficeDocumentKey_idx" ON "ThesisWordFile"("onlyofficeDocumentKey");
CREATE INDEX IF NOT EXISTS "ThesisWordFileVersion_editorUserId_idx" ON "ThesisWordFileVersion"("editorUserId");
CREATE INDEX IF NOT EXISTS "ThesisWordFileVersion_checksum_idx" ON "ThesisWordFileVersion"("checksum");
