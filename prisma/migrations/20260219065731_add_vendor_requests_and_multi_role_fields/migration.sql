/*
  Warnings:

  - You are about to drop the column `supplierType` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `vendorApprovedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `vendorApprovedBy` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `vendorRejectedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `vendorRejectionReason` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `vendorRequestStatus` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `vendorRequested` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `vendorRequestedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `vendor_requests` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `firstName` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lastName` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "vendor_requests" DROP CONSTRAINT "vendor_requests_preferredSiteId_fkey";

-- DropForeignKey
ALTER TABLE "vendor_requests" DROP CONSTRAINT "vendor_requests_reviewedBy_fkey";

-- DropForeignKey
ALTER TABLE "vendor_requests" DROP CONSTRAINT "vendor_requests_userId_fkey";

-- DropIndex
DROP INDEX "sites_name_key";

-- DropIndex
DROP INDEX "users_clientAccountType_idx";

-- DropIndex
DROP INDEX "users_vendorRequestStatus_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "supplierType",
DROP COLUMN "vendorApprovedAt",
DROP COLUMN "vendorApprovedBy",
DROP COLUMN "vendorRejectedAt",
DROP COLUMN "vendorRejectionReason",
DROP COLUMN "vendorRequestStatus",
DROP COLUMN "vendorRequested",
DROP COLUMN "vendorRequestedAt",
ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "lastName" SET NOT NULL;

-- DropTable
DROP TABLE "vendor_requests";
