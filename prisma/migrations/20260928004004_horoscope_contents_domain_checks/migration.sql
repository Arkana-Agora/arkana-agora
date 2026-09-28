-- This is an empty migration.

-- ─── Review Step 4 — I6 (data-integrity-guardian) ───────────────────────────
-- CHECKs dos domínios de HoroscopeContent (schema.prisma L429/L432):
-- type 'western' | 'chinese' | 'maya' e period 'daily' | 'weekly' | 'monthly'.
-- Tabela com 1660 linhas já dentro do domínio (verificado antes de ADD).
-- Estender um domínio exige migration futura (DROP CONSTRAINT + ADD CONSTRAINT).

ALTER TABLE "horoscope_contents" ADD CONSTRAINT "horoscope_contents_type_check"
  CHECK ("type" IN ('western', 'chinese', 'maya'));
ALTER TABLE "horoscope_contents" ADD CONSTRAINT "horoscope_contents_period_check"
  CHECK ("period" IN ('daily', 'weekly', 'monthly'));
