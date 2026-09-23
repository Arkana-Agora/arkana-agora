-- DropIndex
DROP INDEX "interpretations_cacheHash_idx";

-- CreateTable
CREATE TABLE "arcana_calculations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "fullName" TEXT NOT NULL,
    "reductionDate" TEXT NOT NULL,
    "reductionName" TEXT NOT NULL,
    "arcanaNumber" INTEGER NOT NULL,
    "arcanaName" TEXT NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arcana_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "arcana_calculations_userId_createdAt_idx" ON "arcana_calculations"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "follow_up_messages_interpretationId_idx" ON "follow_up_messages"("interpretationId");

-- CreateIndex
CREATE INDEX "reading_cards_readingId_idx" ON "reading_cards"("readingId");

-- AddForeignKey
ALTER TABLE "arcana_calculations" ADD CONSTRAINT "arcana_calculations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
