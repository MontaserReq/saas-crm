CREATE TABLE "AiGatewayUsageLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "providerId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostUsd" DOUBLE PRECISION,
    "durationMs" INTEGER NOT NULL,
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGatewayUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiGatewayUsageLog_organizationId_createdAt_idx" ON "AiGatewayUsageLog"("organizationId", "createdAt");
CREATE INDEX "AiGatewayUsageLog_organizationId_providerId_status_idx" ON "AiGatewayUsageLog"("organizationId", "providerId", "status");
CREATE INDEX "AiGatewayUsageLog_userId_idx" ON "AiGatewayUsageLog"("userId");

ALTER TABLE "AiGatewayUsageLog" ADD CONSTRAINT "AiGatewayUsageLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiGatewayUsageLog" ADD CONSTRAINT "AiGatewayUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
