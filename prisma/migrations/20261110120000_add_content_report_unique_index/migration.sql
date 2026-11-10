-- Add unique index on content_reports for (reporterId, targetType, targetId)
-- Prevents duplicate reports from same user on same target

CREATE UNIQUE INDEX IF NOT EXISTS "unique_user_target_report" ON "content_reports" ("reporterId", "targetType", "targetId");