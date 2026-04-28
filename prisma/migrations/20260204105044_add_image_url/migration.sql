-- AlterTable
ALTER TABLE "cold_boxes" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "cold_plates" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "description" TEXT,
ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "tricycles" ADD COLUMN     "imageUrl" TEXT;
