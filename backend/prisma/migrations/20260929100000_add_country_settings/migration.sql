-- Per-country configuration overrides (pricing, commission, wallet limits,
-- payout rules, bonuses). Purely additive: a country with no rows here keeps
-- inheriting SystemSettings exactly as before, so Nigeria is unaffected.

CREATE TABLE IF NOT EXISTS "CountrySetting" (
  "id"          TEXT         NOT NULL DEFAULT (gen_random_uuid())::text,
  "countryCode" TEXT         NOT NULL,
  "key"         TEXT         NOT NULL,
  "value"       JSONB        NOT NULL,
  "updatedBy"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CountrySetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CountrySetting_countryCode_key_key"
  ON "CountrySetting" ("countryCode", "key");
CREATE INDEX IF NOT EXISTS "CountrySetting_countryCode_idx"
  ON "CountrySetting" ("countryCode");
