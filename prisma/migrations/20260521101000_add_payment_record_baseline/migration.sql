CREATE TABLE "PaymentRecord" (
  "id" TEXT NOT NULL,
  "paymentNo" VARCHAR(40) NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" "PaymentChannel",
  "method" "PaymentMethod",
  "amountCents" INTEGER NOT NULL,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
  "status" VARCHAR(30) NOT NULL DEFAULT 'CREATED',
  "providerTradeNo" VARCHAR(64),
  "providerOrderNo" VARCHAR(64),
  "providerBuyerId" VARCHAR(64),
  "payUrl" TEXT,
  "qrCodeUrl" TEXT,
  "clientPayload" JSONB,
  "rawRequest" JSONB,
  "rawResponse" JSONB,
  "notifyRaw" JSONB,
  "notifyVerified" BOOLEAN,
  "notifyReceivedAt" TIMESTAMP(3),
  "idempotencyKey" VARCHAR(100),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRecord_paymentNo_key" ON "PaymentRecord"("paymentNo");
CREATE INDEX "PaymentRecord_orderId_createdAt_idx" ON "PaymentRecord"("orderId", "createdAt");
CREATE INDEX "PaymentRecord_userId_createdAt_idx" ON "PaymentRecord"("userId", "createdAt");
CREATE INDEX "PaymentRecord_status_createdAt_idx" ON "PaymentRecord"("status", "createdAt");
CREATE INDEX "PaymentRecord_providerTradeNo_idx" ON "PaymentRecord"("providerTradeNo");
CREATE INDEX "PaymentRecord_providerOrderNo_idx" ON "PaymentRecord"("providerOrderNo");

ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
