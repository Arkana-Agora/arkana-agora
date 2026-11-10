-- Add unique index on content_reports for (reporterId, targetType, targetId)
-- Prevents duplicate reports from same user on same target

CREATE UNIQUE INDEX "content_reports_reporterId_targetType_targetId_key" ON "content_reports" ("reporterId", "targetType", "targetId");