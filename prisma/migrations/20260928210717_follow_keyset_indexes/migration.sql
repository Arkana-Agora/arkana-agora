-- DropIndex
DROP INDEX "follows_followerId_idx";

-- DropIndex
DROP INDEX "follows_followingId_idx";

-- CreateIndex
CREATE INDEX "follows_followingId_createdAt_id_idx" ON "follows"("followingId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "follows_followerId_createdAt_id_idx" ON "follows"("followerId", "createdAt", "id");
