-- Revisão R: índices de polling/reverse-lookup via CONCURRENTLY (tabelas
-- grandes em produção não podem bloquear escrita — convenção de
-- docs/03-database/indexing.md + performance-oracle: "manually edit the
-- generated migration SQL file to add CONCURRENTLY"). Migrations
-- Postgres do Prisma Migrate não são envolvidas em transação por
-- default (opt-in via BEGIN/COMMIT), então CONCURRENTLY roda fora de
-- transação aqui — não adicionar BEGIN/COMMIT neste arquivo.

-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "comments_createdAt_idx" ON "comments"("createdAt");

-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "follows_followingId_followerId_idx" ON "follows"("followingId", "followerId");

-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "post_likes_createdAt_idx" ON "post_likes"("createdAt");
