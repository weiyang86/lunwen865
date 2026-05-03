-- AlterTable
ALTER TABLE "PromptTemplate" ADD COLUMN     "draftMetadata" JSONB,
ADD COLUMN     "draftModelConfig" JSONB,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "PromptVersion" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "modelConfig" JSONB;
