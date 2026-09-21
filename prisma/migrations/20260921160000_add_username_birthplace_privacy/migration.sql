-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "username" TEXT,
ADD COLUMN "birthPlace" TEXT,
ADD COLUMN "privacy" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_username_key" ON "UserProfile"("username");
