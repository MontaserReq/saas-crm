CREATE TABLE "SearchProviderUsageLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "providerId" TEXT NOT NULL,
    "purpose" TEXT,
    "queryHash" TEXT,
    "status" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL,
    "estimatedCostUsd" DOUBLE PRECISION,
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchProviderUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SearchProviderUsageLog_organizationId_createdAt_idx" ON "SearchProviderUsageLog"("organizationId", "createdAt");
CREATE INDEX "SearchProviderUsageLog_providerId_status_createdAt_idx" ON "SearchProviderUsageLog"("providerId", "status", "createdAt");
CREATE INDEX "SearchProviderUsageLog_userId_idx" ON "SearchProviderUsageLog"("userId");

ALTER TABLE "SearchProviderUsageLog" ADD CONSTRAINT "SearchProviderUsageLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SearchProviderUsageLog" ADD CONSTRAINT "SearchProviderUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SearchResultCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchResultCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SearchResultCache_cacheKey_key" ON "SearchResultCache"("cacheKey");
CREATE INDEX "SearchResultCache_expiresAt_idx" ON "SearchResultCache"("expiresAt");
CREATE INDEX "SearchResultCache_providerId_createdAt_idx" ON "SearchResultCache"("providerId", "createdAt");
