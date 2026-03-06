-- ============================================================
-- DUORIDE - Full Database Schema
-- Run this in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
--
-- Covers all 19 models:
--   User, DriverProfile, DeliveryPartnerProfile,
--   Ride, Delivery, Payment, Rating,
--   Wallet, WalletTransaction, Payout,
--   AdminProfile, Notification, ActivityLog,
--   SystemSettings, PromoCode,
--   SupportTicket, AppFeedback
-- ============================================================

-- ==================== DROP (for clean re-runs) ====================
-- Uncomment if you need to reset everything:
-- DROP SCHEMA public CASCADE; CREATE SCHEMA public;

-- ==================== ENUMS ====================

CREATE TYPE "UserRole" AS ENUM (
  'CUSTOMER', 'DRIVER', 'DELIVERY_PARTNER',
  'ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT'
);

CREATE TYPE "ServiceType"     AS ENUM ('RIDE', 'DELIVERY');

CREATE TYPE "RideStatus"      AS ENUM (
  'REQUESTED', 'ACCEPTED', 'ARRIVED',
  'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
);

CREATE TYPE "DeliveryStatus"  AS ENUM (
  'PENDING', 'ASSIGNED', 'PICKED_UP',
  'IN_TRANSIT', 'DELIVERED', 'CANCELLED'
);

CREATE TYPE "PaymentStatus"   AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE "PaymentMethod"   AS ENUM ('CASH', 'CARD', 'WALLET');
CREATE TYPE "VehicleType"     AS ENUM ('BIKE', 'CAR', 'MOTORCYCLE', 'VAN');
CREATE TYPE "WalletTxType"    AS ENUM ('CREDIT', 'DEBIT', 'WITHDRAWAL', 'REFUND');
CREATE TYPE "PayoutStatus"    AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- ==================== TABLES ====================

-- ── User ──────────────────────────────────────────────────────
CREATE TABLE "User" (
  "id"                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "email"                TEXT UNIQUE NOT NULL,
  "phone"                TEXT UNIQUE NOT NULL,
  "password"             TEXT NOT NULL,
  "firstName"            TEXT NOT NULL,
  "lastName"             TEXT NOT NULL,
  "role"                 "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "profileImage"         TEXT,
  "isVerified"           BOOLEAN NOT NULL DEFAULT false,
  "isActive"             BOOLEAN NOT NULL DEFAULT true,
  "isSuspended"          BOOLEAN NOT NULL DEFAULT false,
  "suspendedAt"          TIMESTAMP(3),
  "suspendedBy"          TEXT,
  "suspensionReason"     TEXT,
  "passwordResetToken"   TEXT,
  "passwordResetExpires" TIMESTAMP(3),
  "emailVerifyToken"     TEXT,
  "emailVerifyExpires"   TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "User"("email");
CREATE INDEX ON "User"("phone");
CREATE INDEX ON "User"("role");
CREATE INDEX ON "User"("isActive");

-- ── DriverProfile ─────────────────────────────────────────────
CREATE TABLE "DriverProfile" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"          TEXT UNIQUE NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "licenseNumber"   TEXT UNIQUE NOT NULL,
  "vehicleType"     "VehicleType" NOT NULL,
  "vehicleMake"     TEXT NOT NULL,
  "vehicleModel"    TEXT NOT NULL,
  "vehicleYear"     INTEGER NOT NULL,
  "vehicleColor"    TEXT NOT NULL,
  "vehiclePlate"    TEXT UNIQUE NOT NULL,
  "licenseImageUrl" TEXT NOT NULL,
  "vehicleRegUrl"   TEXT NOT NULL,
  "insuranceUrl"    TEXT NOT NULL,
  "isApproved"      BOOLEAN NOT NULL DEFAULT false,
  "isOnline"        BOOLEAN NOT NULL DEFAULT false,
  "currentLat"      DOUBLE PRECISION,
  "currentLng"      DOUBLE PRECISION,
  "totalRides"      INTEGER NOT NULL DEFAULT 0,
  "rating"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "DriverProfile"("isOnline", "currentLat", "currentLng");

-- ── DeliveryPartnerProfile ────────────────────────────────────
CREATE TABLE "DeliveryPartnerProfile" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"          TEXT UNIQUE NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "vehicleType"     "VehicleType" NOT NULL,
  "vehiclePlate"    TEXT,
  "idImageUrl"      TEXT NOT NULL,
  "vehicleImageUrl" TEXT,
  "isApproved"      BOOLEAN NOT NULL DEFAULT false,
  "isOnline"        BOOLEAN NOT NULL DEFAULT false,
  "currentLat"      DOUBLE PRECISION,
  "currentLng"      DOUBLE PRECISION,
  "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
  "rating"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "DeliveryPartnerProfile"("isOnline", "currentLat", "currentLng");

-- ── Ride ─────────────────────────────────────────────────────
CREATE TABLE "Ride" (
  "id"                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "customerId"         TEXT NOT NULL REFERENCES "User"("id"),
  "driverId"           TEXT REFERENCES "User"("id"),
  "pickupAddress"      TEXT NOT NULL,
  "pickupLat"          DOUBLE PRECISION NOT NULL,
  "pickupLng"          DOUBLE PRECISION NOT NULL,
  "dropoffAddress"     TEXT NOT NULL,
  "dropoffLat"         DOUBLE PRECISION NOT NULL,
  "dropoffLng"         DOUBLE PRECISION NOT NULL,
  "status"             "RideStatus" NOT NULL DEFAULT 'REQUESTED',
  "distance"           DOUBLE PRECISION,
  "duration"           INTEGER,
  "estimatedFare"      DOUBLE PRECISION NOT NULL,
  "actualFare"         DOUBLE PRECISION,
  "promoCode"          TEXT,
  "requestedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt"         TIMESTAMP(3),
  "arrivedAt"          TIMESTAMP(3),
  "startedAt"          TIMESTAMP(3),
  "completedAt"        TIMESTAMP(3),
  "cancelledAt"        TIMESTAMP(3),
  "notes"              TEXT,
  "cancellationReason" TEXT
);
CREATE INDEX ON "Ride"("customerId");
CREATE INDEX ON "Ride"("driverId");
CREATE INDEX ON "Ride"("status");
CREATE INDEX ON "Ride"("requestedAt");

-- ── Delivery ─────────────────────────────────────────────────
CREATE TABLE "Delivery" (
  "id"                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "customerId"          TEXT NOT NULL REFERENCES "User"("id"),
  "partnerId"           TEXT REFERENCES "User"("id"),
  "pickupAddress"       TEXT NOT NULL,
  "pickupLat"           DOUBLE PRECISION NOT NULL,
  "pickupLng"           DOUBLE PRECISION NOT NULL,
  "pickupContact"       TEXT NOT NULL,
  "dropoffAddress"      TEXT NOT NULL,
  "dropoffLat"          DOUBLE PRECISION NOT NULL,
  "dropoffLng"          DOUBLE PRECISION NOT NULL,
  "dropoffContact"      TEXT NOT NULL,
  "packageDescription"  TEXT NOT NULL,
  "packageWeight"       DOUBLE PRECISION,
  "packageValue"        DOUBLE PRECISION,
  "status"              "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "distance"            DOUBLE PRECISION,
  "estimatedFee"        DOUBLE PRECISION NOT NULL,
  "actualFee"           DOUBLE PRECISION,
  "deliveryImageUrl"    TEXT,
  "recipientName"       TEXT,
  "recipientSignature"  TEXT,
  "promoCode"           TEXT,
  "requestedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedAt"          TIMESTAMP(3),
  "pickedUpAt"          TIMESTAMP(3),
  "deliveredAt"         TIMESTAMP(3),
  "cancelledAt"         TIMESTAMP(3),
  "notes"               TEXT,
  "cancellationReason"  TEXT
);
CREATE INDEX ON "Delivery"("customerId");
CREATE INDEX ON "Delivery"("partnerId");
CREATE INDEX ON "Delivery"("status");
CREATE INDEX ON "Delivery"("requestedAt");

-- ── Payment ──────────────────────────────────────────────────
CREATE TABLE "Payment" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"        TEXT NOT NULL REFERENCES "User"("id"),
  "rideId"        TEXT UNIQUE REFERENCES "Ride"("id"),
  "deliveryId"    TEXT UNIQUE REFERENCES "Delivery"("id"),
  "amount"        DOUBLE PRECISION NOT NULL,
  "currency"      TEXT NOT NULL DEFAULT 'NGN',
  "method"        "PaymentMethod" NOT NULL,
  "status"        "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "transactionId" TEXT UNIQUE,
  "receiptUrl"    TEXT,
  "platformFee"   DOUBLE PRECISION,
  "driverEarnings" DOUBLE PRECISION,
  "refundAmount"  DOUBLE PRECISION,
  "refundedAt"    TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "Payment"("userId");
CREATE INDEX ON "Payment"("status");

-- ── Rating ───────────────────────────────────────────────────
CREATE TABLE "Rating" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"     TEXT NOT NULL REFERENCES "User"("id"),
  "rideId"     TEXT UNIQUE REFERENCES "Ride"("id"),
  "deliveryId" TEXT UNIQUE REFERENCES "Delivery"("id"),
  "rating"     INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment"    TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "Rating"("userId");

-- ── Wallet ───────────────────────────────────────────────────
CREATE TABLE "Wallet" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"    TEXT UNIQUE NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "balance"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency"  TEXT NOT NULL DEFAULT 'NGN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "Wallet"("userId");

-- ── WalletTransaction ────────────────────────────────────────
CREATE TABLE "WalletTransaction" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "walletId"    TEXT NOT NULL REFERENCES "Wallet"("id") ON DELETE CASCADE,
  "type"        "WalletTxType" NOT NULL,
  "amount"      DOUBLE PRECISION NOT NULL,
  "description" TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'COMPLETED',
  "reference"   TEXT UNIQUE,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "WalletTransaction"("walletId");
CREATE INDEX ON "WalletTransaction"("type");
CREATE INDEX ON "WalletTransaction"("createdAt");

-- ── Payout ───────────────────────────────────────────────────
CREATE TABLE "Payout" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"        TEXT NOT NULL REFERENCES "User"("id"),
  "amount"        DOUBLE PRECISION NOT NULL,
  "currency"      TEXT NOT NULL DEFAULT 'NGN',
  "status"        "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "accountNumber" TEXT NOT NULL,
  "bankCode"      TEXT NOT NULL,
  "accountName"   TEXT NOT NULL,
  "reference"     TEXT UNIQUE,
  "recipientCode" TEXT,
  "processedAt"   TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "Payout"("userId");
CREATE INDEX ON "Payout"("status");

-- ── AdminProfile ─────────────────────────────────────────────
CREATE TABLE "AdminProfile" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"      TEXT UNIQUE NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "permissions" JSONB NOT NULL,
  "department"  TEXT,
  "lastLoginAt" TIMESTAMP(3),
  "loginCount"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "AdminProfile"("userId");

-- ── Notification ─────────────────────────────────────────────
CREATE TABLE "Notification" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title"     TEXT NOT NULL,
  "message"   TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "data"      JSONB,
  "isRead"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "Notification"("userId");
CREATE INDEX ON "Notification"("isRead");
CREATE INDEX ON "Notification"("createdAt");

-- ── ActivityLog ──────────────────────────────────────────────
CREATE TABLE "ActivityLog" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"     TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "action"     TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT,
  "details"    JSONB,
  "ipAddress"  TEXT,
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "ActivityLog"("userId");
CREATE INDEX ON "ActivityLog"("action");
CREATE INDEX ON "ActivityLog"("entityType");
CREATE INDEX ON "ActivityLog"("createdAt");

-- ── SystemSettings ───────────────────────────────────────────
CREATE TABLE "SystemSettings" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "key"         TEXT UNIQUE NOT NULL,
  "value"       JSONB NOT NULL,
  "category"    TEXT NOT NULL,
  "description" TEXT,
  "updatedBy"   TEXT,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "SystemSettings"("category");

-- ── PromoCode ────────────────────────────────────────────────
CREATE TABLE "PromoCode" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code"              TEXT UNIQUE NOT NULL,
  "description"       TEXT,
  "discountType"      TEXT NOT NULL,
  "discountValue"     DOUBLE PRECISION NOT NULL,
  "maxUses"           INTEGER,
  "currentUses"       INTEGER NOT NULL DEFAULT 0,
  "maxUsesPerUser"    INTEGER NOT NULL DEFAULT 1,
  "minPurchaseAmount" DOUBLE PRECISION,
  "validFrom"         TIMESTAMP(3) NOT NULL,
  "validUntil"        TIMESTAMP(3) NOT NULL,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "applicableFor"     TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "PromoCode"("code");
CREATE INDEX ON "PromoCode"("isActive");

-- ── SupportTicket ────────────────────────────────────────────
CREATE TABLE "SupportTicket" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"       TEXT NOT NULL REFERENCES "User"("id"),
  "ticketNumber" TEXT UNIQUE NOT NULL,
  "subject"      TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "category"     TEXT NOT NULL,
  "priority"     TEXT NOT NULL DEFAULT 'medium',
  "status"       TEXT NOT NULL DEFAULT 'open',
  "assignedTo"   TEXT,
  "resolvedAt"   TIMESTAMP(3),
  "resolution"   TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "SupportTicket"("userId");
CREATE INDEX ON "SupportTicket"("status");
CREATE INDEX ON "SupportTicket"("assignedTo");

-- ── AppFeedback ──────────────────────────────────────────────
CREATE TABLE "AppFeedback" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"     TEXT NOT NULL REFERENCES "User"("id"),
  "rating"     INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment"    TEXT,
  "category"   TEXT NOT NULL,
  "platform"   TEXT NOT NULL,
  "appVersion" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "AppFeedback"("userId");
CREATE INDEX ON "AppFeedback"("rating");
CREATE INDEX ON "AppFeedback"("createdAt");

-- ==================== AUTO-UPDATE updatedAt ====================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to every table that has updatedAt
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'User', 'DriverProfile', 'DeliveryPartnerProfile',
    'Payment', 'Wallet', 'Payout',
    'AdminProfile', 'SystemSettings', 'PromoCode',
    'SupportTicket'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON "%s"
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      lower(tbl), tbl
    );
  END LOOP;
END $$;

-- ==================== SEED: Default System Settings ====================

INSERT INTO "SystemSettings" ("key", "value", "category", "description") VALUES
  ('platform_name',          '"DuoRide"',   'general',  'Platform display name'),
  ('base_fare_ride',         '200',         'pricing',  'Base fare for rides in NGN'),
  ('per_km_rate_ride',       '150',         'pricing',  'Per km rate for rides in NGN'),
  ('base_fare_delivery',     '500',         'pricing',  'Base fare for deliveries in NGN'),
  ('per_km_rate_delivery',   '100',         'pricing',  'Per km rate for deliveries in NGN'),
  ('driver_commission',      '0.80',        'pricing',  'Driver share of fare (80%)'),
  ('partner_commission',     '0.85',        'pricing',  'Delivery partner share (85%)'),
  ('min_payout_amount',      '1000',        'payouts',  'Minimum wallet payout in NGN'),
  ('cancellation_fee',       '200',         'pricing',  'Ride cancellation fee in NGN'),
  ('support_email',          '"support@duoride.com"', 'general', 'Support contact email')
ON CONFLICT ("key") DO NOTHING;

-- ==================== VERIFY ====================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================
-- Done! 19 tables created with:
--   ✓ Indexes on all foreign keys and filter columns
--   ✓ updatedAt auto-triggers
--   ✓ Check constraints on ratings (1–5)
--   ✓ Currency defaults to NGN
--   ✓ Wallet + WalletTransaction + Payout models
--   ✓ Password reset + email verification fields on User
--   ✓ Payment split fields (platformFee, driverEarnings)
--   ✓ Refund tracking (refundAmount, refundedAt)
--   ✓ Promo code support on Ride + Delivery
--   ✓ arrivedAt timestamp on Ride
--   ✓ Default system settings seeded
-- ============================================================