-- CreateTable
CREATE TABLE "vendor_requests" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "description" TEXT,
    "status" "VendorRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vendor_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_requests_email_idx" ON "vendor_requests"("email");

-- CreateIndex
CREATE INDEX "vendor_requests_status_idx" ON "vendor_requests"("status");
