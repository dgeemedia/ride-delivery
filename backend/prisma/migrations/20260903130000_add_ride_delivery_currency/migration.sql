-- AlterTable
-- Defaulted column: every existing Ride row backfills to 'NGN' automatically.
ALTER TABLE "Ride" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN';

-- AlterTable
-- Defaulted column: every existing Delivery row backfills to 'NGN' automatically.
ALTER TABLE "Delivery" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN';