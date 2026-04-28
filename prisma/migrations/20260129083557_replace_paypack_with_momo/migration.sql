/*
  Warnings:

  - You are about to drop the column `paypackTransactionRef` on the `payments` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[momoTransactionRef]` on the table `payments` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "payments_paypackTransactionRef_idx";

-- DropIndex
DROP INDEX "payments_paypackTransactionRef_key";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "paypackTransactionRef",
ADD COLUMN     "momoTransactionRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_momoTransactionRef_key" ON "payments"("momoTransactionRef");

-- CreateIndex
CREATE INDEX "payments_momoTransactionRef_idx" ON "payments"("momoTransactionRef");
