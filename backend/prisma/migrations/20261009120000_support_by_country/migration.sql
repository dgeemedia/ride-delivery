-- Support by country + language. Additive, safe to re-run; back-fills old tickets once.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'SupportTicket' AND column_name = 'countryCode'
  ) THEN
    ALTER TABLE "SupportTicket" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'NG';
    ALTER TABLE "SupportTicket" ADD COLUMN "language"    TEXT NOT NULL DEFAULT 'en';
    UPDATE "SupportTicket" t SET "countryCode" = u."countryCode" FROM "User" u WHERE u."id" = t."userId";
    UPDATE "SupportTicket" t SET "language" = COALESCE(NULLIF(c."languageCode", ''), 'en')
      FROM "Country" c WHERE c."code" = t."countryCode";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SupportTicket_countryCode_idx" ON "SupportTicket"("countryCode");
CREATE INDEX IF NOT EXISTS "SupportTicket_language_idx"    ON "SupportTicket"("language");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supportCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supportLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
