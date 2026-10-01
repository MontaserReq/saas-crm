-- Forward-only additive migration. Existing data is assigned to one legacy
-- organization so no business records or relationships are deleted.
CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logoKey" TEXT,
  "logoProvider" TEXT NOT NULL DEFAULT 'local',
  "primaryColor" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "language" TEXT NOT NULL DEFAULT 'en',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Organization_isActive_idx" ON "Organization"("isActive");

CREATE TABLE "OrganizationMember" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastActiveAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");
CREATE INDEX "OrganizationMember_userId_status_idx" ON "OrganizationMember"("userId", "status");
CREATE INDEX "OrganizationMember_organizationId_status_idx" ON "OrganizationMember"("organizationId", "status");
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Team" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Team_organizationId_name_key" ON "Team"("organizationId", "name");
CREATE INDEX "Team_organizationId_isActive_idx" ON "Team"("organizationId", "isActive");
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TeamMember" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OrganizationSettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "enabledModules" TEXT NOT NULL DEFAULT '[]',
  "clientTypes" TEXT NOT NULL DEFAULT '[]',
  "leadStatuses" TEXT NOT NULL DEFAULT '[]',
  "ticketStatuses" TEXT NOT NULL DEFAULT '[]',
  "notificationPreferences" TEXT NOT NULL DEFAULT '{}',
  "dateFormat" TEXT NOT NULL DEFAULT 'yyyy-MM-dd',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationSettings_organizationId_key" ON "OrganizationSettings"("organizationId");
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OrganizationInvite" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "roleId" TEXT,
  "tokenHash" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "invitedUserId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationInvite_tokenHash_key" ON "OrganizationInvite"("tokenHash");
CREATE INDEX "OrganizationInvite_organizationId_email_idx" ON "OrganizationInvite"("organizationId", "email");
CREATE INDEX "OrganizationInvite_expiresAt_idx" ON "OrganizationInvite"("expiresAt");
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Organization" ("id", "name", "slug", "timezone", "currency", "language", "updatedAt")
VALUES ('org_codeline_legacy', 'CodeLine', 'codeline', 'Asia/Amman', 'JOD', 'ar', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "OrganizationMember" ("id", "organizationId", "userId", "roleId", "status", "updatedAt")
SELECT 'org_member_' || md5(u."id"), 'org_codeline_legacy', u."id", u."roleId", 'ACTIVE', CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("organizationId", "userId") DO NOTHING;

INSERT INTO "OrganizationSettings" ("id", "organizationId", "enabledModules", "clientTypes", "leadStatuses", "ticketStatuses", "updatedAt")
VALUES ('org_settings_codeline_legacy', 'org_codeline_legacy', '["schools","tickets","calendar","proposals","messages","chat","ai_research"]', '["School"]', '["NEW","CONTACTED","QUALIFIED","CONVERTED","LOST"]', '["PENDING","IN_PROGRESS","COMPLETED","CLOSED"]', CURRENT_TIMESTAMP)
ON CONFLICT ("organizationId") DO NOTHING;
