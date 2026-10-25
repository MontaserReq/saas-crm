-- Smart Excel/CSV import staging and history.
CREATE TABLE "DataImport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "destination" TEXT,
    "recommendedDestination" TEXT,
    "originalFilename" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "mode" TEXT NOT NULL DEFAULT 'CREATE',
    "matchField" TEXT,
    "headers" JSONB NOT NULL,
    "sourceRows" JSONB,
    "mapping" JSONB,
    "proposedCustomFields" JSONB,
    "failureRows" JSONB,
    "errorMessage" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataImport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DataImport_organizationId_idempotencyKey_key" ON "DataImport"("organizationId", "idempotencyKey");
CREATE INDEX "DataImport_organizationId_createdAt_idx" ON "DataImport"("organizationId", "createdAt");
CREATE INDEX "DataImport_organizationId_status_idx" ON "DataImport"("organizationId", "status");
CREATE INDEX "DataImport_initiatedById_createdAt_idx" ON "DataImport"("initiatedById", "createdAt");
CREATE INDEX "DataImport_expiresAt_idx" ON "DataImport"("expiresAt");
ALTER TABLE "DataImport" ADD CONSTRAINT "DataImport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataImport" ADD CONSTRAINT "DataImport_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
