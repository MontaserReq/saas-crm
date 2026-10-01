-- DropIndex
DROP INDEX "ActivityEvent_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "Attachment_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "AuditLog_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "CalendarEvent_organizationId_startDate_idx";

-- DropIndex
DROP INDEX "ChatConversation_organizationId_updatedAt_idx";

-- DropIndex
DROP INDEX "Department_organizationId_idx";

-- DropIndex
DROP INDEX "Message_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "MessageAttachment_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "MessageTemplate_organizationId_isActive_idx";

-- DropIndex
DROP INDEX "Notification_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "Proposal_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "Proposal_organizationId_status_idx";

-- DropIndex
DROP INDEX "ProposalTemplate_organizationId_isActive_idx";

-- DropIndex
DROP INDEX "SchoolApprovalRequest_organizationId_status_idx";

-- DropIndex
DROP INDEX "SchoolAssignment_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "SchoolResearchJob_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "TaskType_organizationId_isActive_idx";

-- DropIndex
DROP INDEX "Ticket_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "Ticket_organizationId_status_idx";

-- DropIndex
DROP INDEX "TicketApprovalRequest_organizationId_status_idx";

-- DropIndex
DROP INDEX "Todo_organizationId_createdAt_idx";

-- AlterTable
ALTER TABLE "CalendarEvent" ALTER COLUMN "type" SET DEFAULT 'MEETING';

-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Contact" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Lead" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Proposal" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProposalTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'OPEN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "clientId" TEXT,
    "primaryContactId" TEXT,
    "leadId" TEXT,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "value" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "probability" INTEGER,
    "expectedCloseDate" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealAssignee" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "ownerId" TEXT,
    "assignedUserId" TEXT,
    "assignedTeamId" TEXT,
    "createdById" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "contactId" TEXT,
    "dealId" TEXT,
    "ticketId" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pipeline_organizationId_isActive_idx" ON "Pipeline"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Pipeline_organizationId_isDefault_idx" ON "Pipeline"("organizationId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "Pipeline_organizationId_name_key" ON "Pipeline"("organizationId", "name");

-- CreateIndex
CREATE INDEX "PipelineStage_organizationId_pipelineId_order_idx" ON "PipelineStage"("organizationId", "pipelineId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_pipelineId_name_key" ON "PipelineStage"("pipelineId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_pipelineId_order_key" ON "PipelineStage"("pipelineId", "order");

-- CreateIndex
CREATE INDEX "Deal_organizationId_status_idx" ON "Deal"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Deal_organizationId_pipelineId_stageId_idx" ON "Deal"("organizationId", "pipelineId", "stageId");

-- CreateIndex
CREATE INDEX "Deal_organizationId_ownerId_idx" ON "Deal"("organizationId", "ownerId");

-- CreateIndex
CREATE INDEX "Deal_organizationId_createdAt_idx" ON "Deal"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "DealAssignee_userId_idx" ON "DealAssignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DealAssignee_dealId_userId_key" ON "DealAssignee"("dealId", "userId");

-- CreateIndex
CREATE INDEX "CrmTask_organizationId_status_idx" ON "CrmTask"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CrmTask_organizationId_assignedUserId_idx" ON "CrmTask"("organizationId", "assignedUserId");

-- CreateIndex
CREATE INDEX "CrmTask_organizationId_assignedTeamId_idx" ON "CrmTask"("organizationId", "assignedTeamId");

-- CreateIndex
CREATE INDEX "CrmTask_organizationId_dueDate_idx" ON "CrmTask"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "CrmTask_organizationId_createdAt_idx" ON "CrmTask"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Department_organizationId_isActive_idx" ON "Department"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "School_organizationId_createdAt_idx" ON "School"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAssignee" ADD CONSTRAINT "DealAssignee_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAssignee" ADD CONSTRAINT "DealAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
