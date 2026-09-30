-- CreateIndex
CREATE INDEX "comments_parentCommentId_idx" ON "comments"("parentCommentId");

-- CreateIndex
CREATE INDEX "post_hashtags_postId_idx" ON "post_hashtags"("postId");
