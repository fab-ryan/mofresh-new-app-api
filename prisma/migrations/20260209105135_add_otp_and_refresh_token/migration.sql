-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refreshToken" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "otps" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "otps_email_idx" ON "otps"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "otps_userId_idx" ON "otps"("userId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'otps_userId_fkey') THEN
        ALTER TABLE "otps" ADD CONSTRAINT "otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
