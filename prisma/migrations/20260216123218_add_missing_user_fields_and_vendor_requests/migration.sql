-- CreateEnum for ClientAccountType
DO $$ BEGIN
 CREATE TYPE "ClientAccountType" AS ENUM ('PERSONAL', 'BUSINESS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum for VendorRequestStatus
DO $$ BEGIN
 CREATE TYPE "VendorRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- AlterTable users: Make firstName and lastName nullable
ALTER TABLE "users" ALTER COLUMN "firstName" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "lastName" DROP NOT NULL;

-- AlterTable users: Add new columns
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clientAccountType" "ClientAccountType";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "businessName" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tinNumber" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "businessCertificateDocument" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nationalIdDocument" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vendorRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vendorRequestStatus" "VendorRequestStatus";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vendorRequestedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vendorApprovedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vendorApprovedBy" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vendorRejectedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vendorRejectionReason" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supplierType" TEXT;

-- CreateTable vendor_requests
CREATE TABLE IF NOT EXISTS "vendor_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "VendorRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedRole" "UserRole" NOT NULL DEFAULT 'SUPPLIER',
    "businessDescription" TEXT,
    "productsOffered" TEXT,
    "expectedVolume" TEXT,
    "preferredSiteId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for users.clientAccountType
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname = 'users_clientAccountType_idx'
    ) THEN
        CREATE INDEX "users_clientAccountType_idx" ON "users"("clientAccountType");
    END IF;
END $$;

-- CreateIndex for users.vendorRequestStatus
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname = 'users_vendorRequestStatus_idx'
    ) THEN
        CREATE INDEX "users_vendorRequestStatus_idx" ON "users"("vendorRequestStatus");
    END IF;
END $$;

-- CreateIndex for vendor_requests
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'vendor_requests' 
        AND indexname = 'vendor_requests_userId_idx'
    ) THEN
        CREATE INDEX "vendor_requests_userId_idx" ON "vendor_requests"("userId");
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'vendor_requests' 
        AND indexname = 'vendor_requests_status_idx'
    ) THEN
        CREATE INDEX "vendor_requests_status_idx" ON "vendor_requests"("status");
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'vendor_requests' 
        AND indexname = 'vendor_requests_createdAt_idx'
    ) THEN
        CREATE INDEX "vendor_requests_createdAt_idx" ON "vendor_requests"("createdAt");
    END IF;
END $$;

-- AddForeignKey for vendor_requests
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'vendor_requests_userId_fkey'
    ) THEN
        ALTER TABLE "vendor_requests" ADD CONSTRAINT "vendor_requests_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'vendor_requests_reviewedBy_fkey'
    ) THEN
        ALTER TABLE "vendor_requests" ADD CONSTRAINT "vendor_requests_reviewedBy_fkey" 
        FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'vendor_requests_preferredSiteId_fkey'
    ) THEN
        ALTER TABLE "vendor_requests" ADD CONSTRAINT "vendor_requests_preferredSiteId_fkey" 
        FOREIGN KEY ("preferredSiteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
