-- CreateTable
CREATE TABLE "post_like_rewards" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_like_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_like_rewards" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_like_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "post_like_rewards_postId_userId_key" ON "post_like_rewards"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_like_rewards_commentId_userId_key" ON "comment_like_rewards"("commentId", "userId");

-- AddForeignKey
ALTER TABLE "post_like_rewards" ADD CONSTRAINT "post_like_rewards_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_like_rewards" ADD CONSTRAINT "post_like_rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_like_rewards" ADD CONSTRAINT "comment_like_rewards_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_like_rewards" ADD CONSTRAINT "comment_like_rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
