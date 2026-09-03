-- AlterTable
-- All new columns are nullable-or-defaulted, so this backfills every
-- existing row automatically at the DB level. No data migration script
-- needed, no downtime, no impact on current NGN users.
ALTER TABLE "User" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'NG';
ALTER TABLE "User" ADD COLUMN "locale" TEXT;

-- CreateIndex
CREATE INDEX "User_countryCode_idx" ON "User"("countryCode");

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN "payoutMethod" TEXT DEFAULT 'NG_BANK_TRANSFER';
ALTER TABLE "Payout" ADD COLUMN "payoutDetails" JSONB;

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "currencySymbol" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL,
    "phoneDialCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "paymentProviders" JSONB NOT NULL,
    "payoutMethod" TEXT NOT NULL DEFAULT 'NG_BANK_TRANSFER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE INDEX "Country_isActive_idx" ON "Country"("isActive");

-- Seed the Nigeria row so existing users/wallets/payouts have a matching
-- Country record from day one. Safe to run multiple times.
INSERT INTO "Country" (
  "id", "code", "name", "currencyCode", "currencySymbol",
  "defaultLocale", "phoneDialCode", "isActive", "paymentProviders",
  "payoutMethod", "createdAt", "updatedAt"
)
VALUES (
  (gen_random_uuid())::text,
  'NG',
  'Nigeria',
  'NGN',
  '₦',
  'en-NG',
  '+234',
  true,
  '["paystack","flutterwave"]',
  'NG_BANK_TRANSFER',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;
