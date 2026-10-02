CREATE TABLE "OperationExecution" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "operationType" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "leaseExpiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "ownerToken" TEXT,
    "resultPayload" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationExecution_organizationId_operationType_idempotencyKey_key"
ON "OperationExecution"("organizationId", "operationType", "idempotencyKey");

CREATE INDEX "OperationExecution_operationType_status_leaseExpiresAt_idx"
ON "OperationExecution"("operationType", "status", "leaseExpiresAt");

CREATE INDEX "OperationExecution_organizationId_operationType_status_idx"
ON "OperationExecution"("organizationId", "operationType", "status");

CREATE INDEX "OperationExecution_userId_operationType_status_idx"
ON "OperationExecution"("userId", "operationType", "status");

ALTER TABLE "OperationExecution"
ADD CONSTRAINT "OperationExecution_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OperationExecution"
ADD CONSTRAINT "OperationExecution_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
