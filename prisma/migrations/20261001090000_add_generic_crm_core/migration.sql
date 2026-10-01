-- Phase 3A: expand the tenant CRM into generic Clients, Leads, and Contacts.
-- School remains intact for compatibility; migrated School ids are reused as
-- Client ids so existing URLs and historical relations remain stable.

CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "category" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "logoKey" TEXT,
    "logoProvider" TEXT NOT NULL DEFAULT 'local',
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "assignedUserId" TEXT,
    "assignedTeamId" TEXT,
    "convertedClientId" TEXT,
    "convertedContactId" TEXT,
    "clientId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "jobTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "assignedUserId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Ticket" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "clientId" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN "clientId" TEXT;

-- Backfill one canonical Client per legacy School. IDs are intentionally
-- preserved so old school URLs and references can be resolved during rollout.
INSERT INTO "Client" (
    "id", "organizationId", "name", "type", "status", "description",
    "email", "phone", "address", "logoKey", "logoProvider",
    "createdById", "createdAt", "updatedAt"
)
SELECT
    s."id",
    COALESCE(s."organizationId", 'org_codeline_legacy'),
    s."name",
    'SCHOOL',
    CASE WHEN s."isDeleted" OR s."status" = 'INACTIVE' THEN 'INACTIVE' ELSE 'ACTIVE' END,
    COALESCE(s."publicDescription", s."notes"),
    s."email",
    s."phone",
    NULLIF(CONCAT_WS(', ', s."area", s."city"), ''),
    s."logoKey",
    COALESCE(s."logoProvider", 'local'),
    s."createdById",
    s."createdAt",
    s."updatedAt"
FROM "School" s
ON CONFLICT ("id") DO NOTHING;

-- Preserve existing named school contacts without polluting Client with
-- school-only contact fields.
INSERT INTO "Contact" ("id", "organizationId", "clientId", "firstName", "isPrimary", "createdAt", "updatedAt")
SELECT
    s."id" || '-primary-contact',
    COALESCE(s."organizationId", 'org_codeline_legacy'),
    s."id",
    s."contactPerson",
    true,
    s."createdAt",
    s."updatedAt"
FROM "School" s
WHERE s."contactPerson" IS NOT NULL AND BTRIM(s."contactPerson") <> ''
ON CONFLICT ("id") DO NOTHING;

UPDATE "Ticket" SET "clientId" = "schoolId" WHERE "schoolId" IS NOT NULL;
UPDATE "Proposal" SET "clientId" = "schoolId" WHERE "schoolId" IS NOT NULL;
UPDATE "CalendarEvent" SET "clientId" = "schoolId" WHERE "schoolId" IS NOT NULL;

ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedClientId_fkey" FOREIGN KEY ("convertedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedContactId_fkey" FOREIGN KEY ("convertedContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Client_organizationId_status_idx" ON "Client"("organizationId", "status");
CREATE INDEX "Client_organizationId_type_idx" ON "Client"("organizationId", "type");
CREATE INDEX "Client_organizationId_name_idx" ON "Client"("organizationId", "name");
CREATE INDEX "Lead_organizationId_status_idx" ON "Lead"("organizationId", "status");
CREATE INDEX "Lead_organizationId_assignedUserId_idx" ON "Lead"("organizationId", "assignedUserId");
CREATE INDEX "Lead_organizationId_assignedTeamId_idx" ON "Lead"("organizationId", "assignedTeamId");
CREATE INDEX "Lead_organizationId_clientId_idx" ON "Lead"("organizationId", "clientId");
CREATE INDEX "Contact_organizationId_clientId_idx" ON "Contact"("organizationId", "clientId");
CREATE INDEX "Contact_organizationId_email_idx" ON "Contact"("organizationId", "email");
CREATE INDEX "Contact_organizationId_assignedUserId_idx" ON "Contact"("organizationId", "assignedUserId");
CREATE INDEX "Ticket_organizationId_clientId_idx" ON "Ticket"("organizationId", "clientId");
CREATE INDEX "Proposal_organizationId_clientId_idx" ON "Proposal"("organizationId", "clientId");
CREATE INDEX "CalendarEvent_organizationId_clientId_idx" ON "CalendarEvent"("organizationId", "clientId");
