ALTER TABLE "SchoolResearchJob" ADD COLUMN "currentOperationId" TEXT;

CREATE UNIQUE INDEX "SchoolResearchJob_currentOperationId_key"
ON "SchoolResearchJob"("currentOperationId");

ALTER TABLE "SchoolResearchJob"
ADD CONSTRAINT "SchoolResearchJob_currentOperationId_fkey"
FOREIGN KEY ("currentOperationId") REFERENCES "OperationExecution"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
