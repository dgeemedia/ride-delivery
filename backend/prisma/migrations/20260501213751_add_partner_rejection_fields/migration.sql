-- AlterTable
ALTER TABLE "DeliveryPartnerProfile" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "documentsUploadedAt" TIMESTAMP(3),
ADD COLUMN     "isRejected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedBy" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- CreateIndex
CREATE INDEX "DeliveryPartnerProfile_isRejected_idx" ON "DeliveryPartnerProfile"("isRejected");
