/*
  Warnings:

  - You are about to drop the column `clientAccountType` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PERSONAL', 'BUSINESS');

-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "capacityNeededKg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" RENAME COLUMN "clientAccountType" TO "accountType";
ALTER TABLE "users" ALTER COLUMN "accountType" TYPE "AccountType" USING "accountType"::text::"AccountType";

-- DropEnum
DROP TYPE "ClientAccountType";
