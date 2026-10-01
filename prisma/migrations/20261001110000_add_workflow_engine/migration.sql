CREATE TABLE "Workflow" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "entityType" TEXT NOT NULL, "triggerType" TEXT NOT NULL, "conditions" JSONB NOT NULL, "actions" JSONB NOT NULL,
  "executionConfig" JSONB, "isActive" BOOLEAN NOT NULL DEFAULT false, "archivedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL, "updatedById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WorkflowExecution" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "workflowId" TEXT NOT NULL, "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "errorMessage" TEXT, "retryCount" INTEGER NOT NULL DEFAULT 0, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Workflow_organizationId_name_key" ON "Workflow"("organizationId", "name");
CREATE INDEX "Workflow_organizationId_isActive_entityType_triggerType_idx" ON "Workflow"("organizationId", "isActive", "entityType", "triggerType");
CREATE INDEX "Workflow_organizationId_archivedAt_idx" ON "Workflow"("organizationId", "archivedAt");
CREATE UNIQUE INDEX "WorkflowExecution_organizationId_workflowId_eventId_key" ON "WorkflowExecution"("organizationId", "workflowId", "eventId");
CREATE INDEX "WorkflowExecution_organizationId_status_createdAt_idx" ON "WorkflowExecution"("organizationId", "status", "createdAt");
CREATE INDEX "WorkflowExecution_organizationId_workflowId_createdAt_idx" ON "WorkflowExecution"("organizationId", "workflowId", "createdAt");
CREATE INDEX "WorkflowExecution_organizationId_eventType_entityType_entityId_idx" ON "WorkflowExecution"("organizationId", "eventType", "entityType", "entityId");
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
