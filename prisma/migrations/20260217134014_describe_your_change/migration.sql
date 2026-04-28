/*
  Warnings:

  - A unique constraint covering the columns `[email,code]` on the table `otps` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "AssetType" ADD VALUE 'COLD_ROOM';

-- CreateIndex
CREATE UNIQUE INDEX "otps_email_code_key" ON "otps"("email", "code");
