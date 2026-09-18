-- Orange Money support + per-country credit/payout method configuration.
--
-- Every column added here is nullable with no backfill required: country.service.js
-- derives sensible defaults from the existing `paymentProviders` / `payoutMethod`
-- columns when these are NULL, so existing rows (and Nigeria in particular)
-- behave exactly as they did before this migration.

-- ── Country: multi-provider config ──────────────────────────────────────────
ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "creditMethods"  JSONB;
ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "payoutMethods"  JSONB;
ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "providerConfig" JSONB;
ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "languageCode"   TEXT;

-- Backfill languageCode from the locale we already store (e.g. 'fr-CI' -> 'fr')
UPDATE "Country"
   SET "languageCode" = split_part("defaultLocale", '-', 1)
 WHERE "languageCode" IS NULL
   AND "defaultLocale" IS NOT NULL;

-- ── Provider-side handles (Orange pay_token) ────────────────────────────────
ALTER TABLE "WalletTransaction" ADD COLUMN IF NOT EXISTS "providerRef" TEXT;
ALTER TABLE "Payment"           ADD COLUMN IF NOT EXISTS "providerRef" TEXT;

-- ── PaymentMethod: mobile money ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
     WHERE enumlabel = 'MOBILE_MONEY'
       AND enumtypid = 'public."PaymentMethod"'::regtype
  ) THEN
    ALTER TYPE "PaymentMethod" ADD VALUE 'MOBILE_MONEY';
  END IF;
END
$$;

-- Lets the admin dashboard filter payouts/payments by rail without a scan
CREATE INDEX IF NOT EXISTS "Payout_payoutMethod_idx" ON "Payout" ("payoutMethod");
CREATE INDEX IF NOT EXISTS "Payment_provider_idx"    ON "Payment" ("provider");
