-- AlterTable
ALTER TABLE "PromptTemplate" ADD COLUMN     "draftContent" TEXT,
ADD COLUMN     "draftModel" VARCHAR(50),
ADD COLUMN     "draftModelParams" JSONB,
ADD COLUMN     "draftUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "draftVariables" JSONB;
