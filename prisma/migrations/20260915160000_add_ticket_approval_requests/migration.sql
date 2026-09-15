CREATE TABLE "TicketApprovalRequest" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "decidedById" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "proposedData" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "TicketApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TicketApprovalRequest_status_type_idx" ON "TicketApprovalRequest"("status", "type");
CREATE INDEX "TicketApprovalRequest_ticketId_createdAt_idx" ON "TicketApprovalRequest"("ticketId", "createdAt");
CREATE INDEX "TicketApprovalRequest_requesterId_idx" ON "TicketApprovalRequest"("requesterId");

ALTER TABLE "TicketApprovalRequest" ADD CONSTRAINT "TicketApprovalRequest_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketApprovalRequest" ADD CONSTRAINT "TicketApprovalRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketApprovalRequest" ADD CONSTRAINT "TicketApprovalRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
