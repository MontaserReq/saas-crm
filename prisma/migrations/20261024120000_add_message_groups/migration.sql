CREATE TABLE "MessageGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageGroup_organizationId_name_key" ON "MessageGroup"("organizationId", "name");
CREATE INDEX "MessageGroup_organizationId_createdAt_idx" ON "MessageGroup"("organizationId", "createdAt");
CREATE INDEX "MessageGroup_createdById_idx" ON "MessageGroup"("createdById");
CREATE UNIQUE INDEX "MessageGroupMember_groupId_userId_key" ON "MessageGroupMember"("groupId", "userId");
CREATE INDEX "MessageGroupMember_userId_idx" ON "MessageGroupMember"("userId");

ALTER TABLE "MessageGroup" ADD CONSTRAINT "MessageGroup_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageGroup" ADD CONSTRAINT "MessageGroup_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageGroupMember" ADD CONSTRAINT "MessageGroupMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "MessageGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageGroupMember" ADD CONSTRAINT "MessageGroupMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
