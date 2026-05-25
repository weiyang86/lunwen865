-- CreateEnum
CREATE TYPE "TopicCandidateRevisionType" AS ENUM ('AI_GENERATED', 'CUSTOM_SELECT', 'ADVISOR_EDIT', 'MANUAL_EDIT');

-- CreateTable
CREATE TABLE "PaymentCallbackLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "channel" "PaymentChannel" NOT NULL,
    "rawHeaders" JSONB,
    "rawBody" TEXT,
    "rawQuery" JSONB,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "normalizedStatus" VARCHAR(30),
    "processStatus" VARCHAR(30),
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCallbackLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicCandidateRevision" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "type" "TopicCandidateRevisionType" NOT NULL,
    "note" TEXT,
    "beforeTitle" TEXT,
    "afterTitle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicCandidateRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentCallbackLog_channel_createdAt_idx" ON "PaymentCallbackLog"("channel", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentCallbackLog_orderId_createdAt_idx" ON "PaymentCallbackLog"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "TopicCandidateRevision_candidateId_idx" ON "TopicCandidateRevision"("candidateId");

-- CreateIndex
CREATE INDEX "TopicCandidateRevision_type_idx" ON "TopicCandidateRevision"("type");

-- CreateIndex
CREATE INDEX "TopicCandidateRevision_createdAt_idx" ON "TopicCandidateRevision"("createdAt");

-- AddForeignKey
ALTER TABLE "PaymentCallbackLog" ADD CONSTRAINT "PaymentCallbackLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicCandidateRevision" ADD CONSTRAINT "TopicCandidateRevision_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "TopicCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
