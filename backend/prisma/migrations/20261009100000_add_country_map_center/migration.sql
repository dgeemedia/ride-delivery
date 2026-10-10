-- Per-country map centre (fallback camera + search bias). Additive and idempotent.
ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "mapCenterLat"  DOUBLE PRECISION;
ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "mapCenterLng"  DOUBLE PRECISION;
ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "mapCenterCity" TEXT;

-- Back-fill the seeded markets. Only touches rows with no centre yet, so it
-- never overwrites a value an admin has already set.
UPDATE "Country" SET "mapCenterLat" = 6.5244, "mapCenterLng" = 3.3792, "mapCenterCity" = 'Lagos' WHERE "code" = 'NG' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 5.6037, "mapCenterLng" = -0.187, "mapCenterCity" = 'Accra' WHERE "code" = 'GH' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 13.4549, "mapCenterLng" = -16.579, "mapCenterCity" = 'Banjul' WHERE "code" = 'GM' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 14.933, "mapCenterLng" = -23.5133, "mapCenterCity" = 'Praia' WHERE "code" = 'CV' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 6.1725, "mapCenterLng" = 1.2314, "mapCenterCity" = 'Lomé' WHERE "code" = 'TG' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 6.3703, "mapCenterLng" = 2.3912, "mapCenterCity" = 'Cotonou' WHERE "code" = 'BJ' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 5.36, "mapCenterLng" = -4.0083, "mapCenterCity" = 'Abidjan' WHERE "code" = 'CI' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 14.7167, "mapCenterLng" = -17.4677, "mapCenterCity" = 'Dakar' WHERE "code" = 'SN' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 12.6392, "mapCenterLng" = -8.0029, "mapCenterCity" = 'Bamako' WHERE "code" = 'ML' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 12.3714, "mapCenterLng" = -1.5197, "mapCenterCity" = 'Ouagadougou' WHERE "code" = 'BF' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 13.5116, "mapCenterLng" = 2.1254, "mapCenterCity" = 'Niamey' WHERE "code" = 'NE' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 9.6412, "mapCenterLng" = -13.5784, "mapCenterCity" = 'Conakry' WHERE "code" = 'GN' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 11.8636, "mapCenterLng" = -15.5977, "mapCenterCity" = 'Bissau' WHERE "code" = 'GW' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 8.4657, "mapCenterLng" = -13.2317, "mapCenterCity" = 'Freetown' WHERE "code" = 'SL' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 3.848, "mapCenterLng" = 11.5021, "mapCenterCity" = 'Yaoundé' WHERE "code" = 'CM' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = -18.8792, "mapCenterLng" = 47.5079, "mapCenterCity" = 'Antananarivo' WHERE "code" = 'MG' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = -24.6282, "mapCenterLng" = 25.9231, "mapCenterCity" = 'Gaborone' WHERE "code" = 'BW' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = -4.4419, "mapCenterLng" = 15.2663, "mapCenterCity" = 'Kinshasa' WHERE "code" = 'CD' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 4.3947, "mapCenterLng" = 18.5582, "mapCenterCity" = 'Bangui' WHERE "code" = 'CF' AND "mapCenterLat" IS NULL;
UPDATE "Country" SET "mapCenterLat" = 6.3156, "mapCenterLng" = -10.8074, "mapCenterCity" = 'Monrovia' WHERE "code" = 'LR' AND "mapCenterLat" IS NULL;
