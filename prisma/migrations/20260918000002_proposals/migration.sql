-- Migration: 20260918000002_proposals
-- Purpose: Add Proposal model for commercial proposal generation.
--          New table only, no existing data affected.

CREATE TABLE "Proposal" (
    "id"                  TEXT NOT NULL,
    "title"               TEXT NOT NULL,
    "clientName"          TEXT NOT NULL,
    "contactPerson"       TEXT,
    "clientEmail"         TEXT,
    "clientPhone"         TEXT,
    "schoolId"            TEXT,
    "logoKey"             TEXT,
    "logoProvider"        TEXT NOT NULL DEFAULT 'local',
    "status"              TEXT NOT NULL DEFAULT 'DRAFT',
    "content"             TEXT,
    "generatedAt"         TIMESTAMP(3),
    "generatedPdfKey"     TEXT,
    "generatedPdfProvider" TEXT NOT NULL DEFAULT 'local',
    "createdById"         TEXT NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Proposal_status_idx"      ON "Proposal"("status");
CREATE INDEX "Proposal_createdById_idx" ON "Proposal"("createdById");
CREATE INDEX "Proposal_schoolId_idx"    ON "Proposal"("schoolId");
CREATE INDEX "Proposal_createdAt_idx"   ON "Proposal"("createdAt");

ALTER TABLE "Proposal"
    ADD CONSTRAINT "Proposal_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Proposal"
    ADD CONSTRAINT "Proposal_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add proposal permissions to the Permission table
INSERT INTO "Permission" ("id", "code", "name", "module", "description")
VALUES
  (gen_random_uuid()::text, 'proposals.view',     'View Proposals',     'proposals', 'Can view proposals list and details'),
  (gen_random_uuid()::text, 'proposals.create',   'Create Proposals',   'proposals', 'Can create new proposals'),
  (gen_random_uuid()::text, 'proposals.update',   'Update Proposals',   'proposals', 'Can edit existing proposals'),
  (gen_random_uuid()::text, 'proposals.delete',   'Delete Proposals',   'proposals', 'Can delete proposals'),
  (gen_random_uuid()::text, 'proposals.generate', 'Generate Proposal PDF', 'proposals', 'Can generate and download PDF proposals')
ON CONFLICT ("code") DO NOTHING;
