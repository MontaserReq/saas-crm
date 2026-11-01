ALTER TABLE "LeadDiscoveryJob" ADD COLUMN "currentOperationId" TEXT;

CREATE UNIQUE INDEX "LeadDiscoveryJob_currentOperationId_key" ON "LeadDiscoveryJob"("currentOperationId");

ALTER TABLE "LeadDiscoveryJob" ADD CONSTRAINT "LeadDiscoveryJob_currentOperationId_fkey" FOREIGN KEY ("currentOperationId") REFERENCES "OperationExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
