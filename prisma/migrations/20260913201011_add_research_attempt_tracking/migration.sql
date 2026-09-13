-- CreateTable
CREATE TABLE "SchoolResearchAttempt" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "webSearches" INTEGER NOT NULL DEFAULT 0,
    "executedTools" TEXT,
    "isRetry" BOOLEAN NOT NULL DEFAULT false,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolResearchAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolResearchAttempt_jobId_idx" ON "SchoolResearchAttempt"("jobId");

-- CreateIndex
CREATE INDEX "SchoolResearchAttempt_provider_idx" ON "SchoolResearchAttempt"("provider");

-- CreateIndex
CREATE INDEX "SchoolResearchAttempt_status_idx" ON "SchoolResearchAttempt"("status");

-- CreateIndex
CREATE INDEX "SchoolResearchAttempt_createdAt_idx" ON "SchoolResearchAttempt"("createdAt");

-- AddForeignKey
ALTER TABLE "SchoolResearchAttempt" ADD CONSTRAINT "SchoolResearchAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SchoolResearchJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
