-- CreateTable
CREATE TABLE "polling_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polling_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "polling_attempts_userId_createdAt_idx" ON "polling_attempts"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "polling_attempts" ADD CONSTRAINT "polling_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
