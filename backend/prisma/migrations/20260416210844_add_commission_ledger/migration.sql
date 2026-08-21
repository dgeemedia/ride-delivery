-- CreateTable
CREATE TABLE "CommissionLedger" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "rideId" TEXT,
    "deliveryId" TEXT,
    "earnerUserId" TEXT NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "bookingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "earnerAmount" DOUBLE PRECISION NOT NULL,
    "surgeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionLedger_paymentId_key" ON "CommissionLedger"("paymentId");

-- CreateIndex
CREATE INDEX "CommissionLedger_serviceType_idx" ON "CommissionLedger"("serviceType");

-- CreateIndex
CREATE INDEX "CommissionLedger_earnerUserId_idx" ON "CommissionLedger"("earnerUserId");

-- CreateIndex
CREATE INDEX "CommissionLedger_createdAt_idx" ON "CommissionLedger"("createdAt");

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_earnerUserId_fkey" FOREIGN KEY ("earnerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
