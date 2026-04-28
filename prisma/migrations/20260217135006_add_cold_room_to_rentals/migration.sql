-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "coldRoomId" TEXT;

-- CreateIndex
CREATE INDEX "rentals_coldRoomId_idx" ON "rentals"("coldRoomId");

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_coldRoomId_fkey" FOREIGN KEY ("coldRoomId") REFERENCES "cold_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
