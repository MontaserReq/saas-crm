ALTER TABLE "ChatConversation" ADD COLUMN "messageGroupId" TEXT;

CREATE UNIQUE INDEX "ChatConversation_messageGroupId_key" ON "ChatConversation"("messageGroupId");

ALTER TABLE "ChatConversation"
ADD CONSTRAINT "ChatConversation_messageGroupId_fkey"
FOREIGN KEY ("messageGroupId") REFERENCES "MessageGroup"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
