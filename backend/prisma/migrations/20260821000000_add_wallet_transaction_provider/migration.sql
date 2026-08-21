-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN "provider" TEXT;

-- CreateIndex
CREATE INDEX "WalletTransaction_provider_idx" ON "WalletTransaction"("provider");