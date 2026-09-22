-- CreateTable
CREATE TABLE "interpretations" (
    "id" TEXT NOT NULL,
    "readingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "mood" TEXT,
    "question" TEXT,
    "content" TEXT NOT NULL,
    "cacheHash" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT 'gpt-4o-2024-08-06',
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "wasCached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interpretations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_messages" (
    "id" TEXT NOT NULL,
    "interpretationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_daily_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "interpretationCount" INTEGER NOT NULL DEFAULT 0,
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_daily_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interpretations_cacheHash_key" ON "interpretations"("cacheHash");

-- CreateIndex
CREATE INDEX "interpretations_cacheHash_idx" ON "interpretations"("cacheHash");

-- CreateIndex
CREATE INDEX "interpretations_readingId_idx" ON "interpretations"("readingId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_daily_usage_userId_date_key" ON "ai_daily_usage"("userId", "date");

-- AddForeignKey
ALTER TABLE "interpretations" ADD CONSTRAINT "interpretations_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "readings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interpretations" ADD CONSTRAINT "interpretations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_messages" ADD CONSTRAINT "follow_up_messages_interpretationId_fkey" FOREIGN KEY ("interpretationId") REFERENCES "interpretations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_daily_usage" ADD CONSTRAINT "ai_daily_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
