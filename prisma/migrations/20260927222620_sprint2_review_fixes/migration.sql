-- CreateIndex
CREATE INDEX "gifts_fromUserId_createdAt_idx" ON "gifts"("fromUserId", "createdAt");

-- ─── Review Step 4 — CRIT-2 + I5 (data-integrity-guardian) ──────────────────

-- 1) Dedupe defensivo da chave completa (mantém a linha mais antiga).
DELETE FROM "horoscope_contents" a
USING "horoscope_contents" b
WHERE a."type" = b."type"
  AND a."signId" = b."signId"
  AND a."element" IS NOT DISTINCT FROM b."element"
  AND a."period" = b."period"
  AND a."date" = b."date"
  AND a.ctid > b.ctid;

-- 2) CRIT-2: unicidade real de (type, signId, element, period, date) com element NULL.
--    Sem NULLS NOT DISTINCT o Postgres trata NULLs como distintos e a @@unique da
--    spec 006 §5 não pega as 1088 linhas sem elemento (western/maya).
DROP INDEX "horoscope_contents_type_signId_element_period_date_key";
CREATE UNIQUE INDEX "horoscope_contents_type_signId_element_period_date_key"
  ON "horoscope_contents"("type", "signId", "element", "period", "date")
  NULLS NOT DISTINCT;

-- 3) CHECKs dos domínios documentados nos comentários do schema.prisma — tabelas
--    vazias agora, custo de validação zero e proteção contra inserts fora do domínio.
--    Estender um domínio exige migration futura (DROP CONSTRAINT + ADD CONSTRAINT).
ALTER TABLE "posts" ADD CONSTRAINT "posts_type_check"
  CHECK ("type" IN ('text', 'image', 'reading'));
ALTER TABLE "posts" ADD CONSTRAINT "posts_audience_check"
  CHECK ("audience" IN ('public', 'followers'));
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check"
  CHECK ("type" IN ('follow', 'like', 'comment', 'gift', 'mention', 'horoscope'));
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_targetType_check"
  CHECK ("targetType" IN ('post', 'comment', 'user'));
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_status_check"
  CHECK ("status" IN ('PENDING', 'REVIEWED', 'REJECTED', 'ACTIONED'));
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_versosBalance_nonneg"
  CHECK ("versosBalance" >= 0);
ALTER TABLE "horoscope_notifications" ADD CONSTRAINT "horoscope_notifications_hour_range"
  CHECK ("hour" BETWEEN 0 AND 23);
