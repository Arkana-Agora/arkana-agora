-- CreateIndex
CREATE INDEX "comments_authorId_idx" ON "comments"("authorId");

-- CreateIndex
CREATE INDEX "content_reports_reporterId_idx" ON "content_reports"("reporterId");

-- CreateIndex
CREATE INDEX "horoscope_contents_type_period_date_idx" ON "horoscope_contents"("type", "period", "date");

-- CreateIndex
CREATE INDEX "post_likes_userId_idx" ON "post_likes"("userId");
