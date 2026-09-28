-- Asserts the hand-written integrity constraints that schema.prisma does NOT
-- model (Prisma does not represent CHECK constraints or NULLS NOT DISTINCT),
-- so `prisma migrate diff` cannot see them: a dropped constraint would keep
-- the CI drift gate green. Run after `migrate deploy` in CI (see
-- .github/workflows/ci.yml) and locally via:
--   npx prisma db execute --file prisma/ci/assert-integrity.sql
DO $$
DECLARE
  missing TEXT := '';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UserProfile_versosBalance_nonneg'
      AND conrelid = '"UserProfile"'::regclass
  ) THEN missing := missing || ' UserProfile_versosBalance_nonneg'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'posts_type_check'
      AND conrelid = 'posts'::regclass
  ) THEN missing := missing || ' posts_type_check'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'posts_audience_check'
      AND conrelid = 'posts'::regclass
  ) THEN missing := missing || ' posts_audience_check'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_type_check'
      AND conrelid = 'notifications'::regclass
  ) THEN missing := missing || ' notifications_type_check'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'content_reports_status_check'
      AND conrelid = 'content_reports'::regclass
  ) THEN missing := missing || ' content_reports_status_check'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'content_reports_targetType_check'
      AND conrelid = 'content_reports'::regclass
  ) THEN missing := missing || ' content_reports_targetType_check'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'horoscope_notifications_hour_range'
      AND conrelid = 'horoscope_notifications'::regclass
  ) THEN missing := missing || ' horoscope_notifications_hour_range'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'horoscope_contents_type_check'
      AND conrelid = 'horoscope_contents'::regclass
  ) THEN missing := missing || ' horoscope_contents_type_check'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'horoscope_contents_period_check'
      AND conrelid = 'horoscope_contents'::regclass
  ) THEN missing := missing || ' horoscope_contents_period_check'; END IF;

  -- Degraded-unique de HoroscopeContents (''::text ≠ NULL): o índice é único
  -- mas com NULLS NOT DISTINCT — único no model Prisma (plain @@unique).
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'horoscope_contents_type_signId_element_period_date_key'
      AND indexdef ILIKE '%NULLS NOT DISTINCT%'
  ) THEN missing := missing || ' horoscope_contents NULLS NOT DISTINCT index'; END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION 'integrity constraints ausentes (drift manual vs migrations):%', missing;
  END IF;
END $$;
