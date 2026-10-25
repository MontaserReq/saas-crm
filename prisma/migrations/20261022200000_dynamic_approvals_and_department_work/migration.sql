ALTER TABLE "OrganizationSettings"
ADD COLUMN "approvalRules" TEXT NOT NULL DEFAULT '{}';

ALTER TABLE "CrmTask"
ADD COLUMN "departmentId" TEXT;

ALTER TABLE "CalendarEvent"
ADD COLUMN "departmentId" TEXT;

ALTER TABLE "CrmTask"
ADD CONSTRAINT "CrmTask_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CalendarEvent"
ADD CONSTRAINT "CalendarEvent_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CalendarEvent" DROP CONSTRAINT IF EXISTS "CalendarEvent_ticketId_fkey";
ALTER TABLE "CalendarEvent"
ADD CONSTRAINT "CalendarEvent_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CrmTask_organizationId_departmentId_idx" ON "CrmTask"("organizationId", "departmentId");
CREATE INDEX "CalendarEvent_organizationId_departmentId_idx" ON "CalendarEvent"("organizationId", "departmentId");
CREATE INDEX "CalendarEvent_organizationId_ticketId_idx" ON "CalendarEvent"("organizationId", "ticketId");

UPDATE "CrmTask" task
SET "departmentId" = employee."departmentId"
FROM "User" employee
WHERE task."departmentId" IS NULL
  AND employee."id" = COALESCE(task."assignedUserId", task."ownerId", task."createdById");

UPDATE "CalendarEvent" event
SET "departmentId" = employee."departmentId"
FROM "User" employee
WHERE event."departmentId" IS NULL
  AND employee."id" = COALESCE(event."userId", event."createdById");

CREATE TABLE "OperationApprovalRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "entityId" TEXT,
  "entityLabel" TEXT,
  "payload" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requesterId" TEXT NOT NULL,
  "decidedById" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "OperationApprovalRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OperationApprovalRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OperationApprovalRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OperationApprovalRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "OperationApprovalRequest_organizationId_status_createdAt_idx" ON "OperationApprovalRequest"("organizationId", "status", "createdAt");
CREATE INDEX "OperationApprovalRequest_requesterId_createdAt_idx" ON "OperationApprovalRequest"("requesterId", "createdAt");
CREATE INDEX "OperationApprovalRequest_resourceType_operation_entityId_idx" ON "OperationApprovalRequest"("resourceType", "operation", "entityId");
