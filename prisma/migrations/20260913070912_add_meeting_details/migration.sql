-- CreateTable
CREATE TABLE "MeetingDetails" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "meetingTime" TEXT NOT NULL,
    "participants" TEXT NOT NULL,
    "actionItems" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingDetails_ticketId_key" ON "MeetingDetails"("ticketId");

-- CreateIndex
CREATE INDEX "MeetingDetails_meetingDate_idx" ON "MeetingDetails"("meetingDate");

-- AddForeignKey
ALTER TABLE "MeetingDetails" ADD CONSTRAINT "MeetingDetails_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingDetails" ADD CONSTRAINT "MeetingDetails_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
