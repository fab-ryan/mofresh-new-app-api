/*
  Warnings:

  - A unique constraint covering the columns `[email,code]` on the table `otps` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('VEGETABLES', 'FRESH_FRUITS', 'MEAT', 'MEDECINE', 'PHARMACEUTICAL');

-- AlterTable
ALTER TABLE "cold_rooms" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE';
