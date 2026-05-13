-- P0-3A: 订单来源与归属数据字段扩展
CREATE TYPE "OrderSourceType" AS ENUM ('DIRECT', 'AGENCY');

ALTER TABLE "Order"
  ADD COLUMN "sourceType" "OrderSourceType" NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN "agencyId" VARCHAR(50);

CREATE INDEX "Order_sourceType_idx" ON "Order"("sourceType");
CREATE INDEX "Order_agencyId_idx" ON "Order"("agencyId");
