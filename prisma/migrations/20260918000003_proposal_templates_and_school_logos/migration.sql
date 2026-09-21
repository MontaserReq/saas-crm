-- Migration: 20260918000003_proposal_templates_and_school_logos
-- Purpose: Add School logo storage, ProposalTemplate model, and Proposal template linkage.
--          Additive and non-destructive.

-- 1. Add logo columns to School
ALTER TABLE "School"
    ADD COLUMN IF NOT EXISTS "logoKey" TEXT,
    ADD COLUMN IF NOT EXISTS "logoProvider" TEXT NOT NULL DEFAULT 'local';

-- 2. Create ProposalTemplate table
CREATE TABLE IF NOT EXISTS "ProposalTemplate" (
    "id"                 TEXT NOT NULL,
    "name"               TEXT NOT NULL,
    "description"        TEXT,
    "pdfStorageKey"      TEXT NOT NULL,
    "pdfStorageProvider" TEXT NOT NULL DEFAULT 'local',
    "originalFileName"   TEXT NOT NULL,
    "fileSize"           INTEGER NOT NULL DEFAULT 0,
    "isActive"           BOOLEAN NOT NULL DEFAULT true,
    "config"             TEXT,
    "createdById"        TEXT NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProposalTemplate_isActive_idx"    ON "ProposalTemplate"("isActive");
CREATE INDEX IF NOT EXISTS "ProposalTemplate_createdById_idx" ON "ProposalTemplate"("createdById");

ALTER TABLE "ProposalTemplate"
    ADD CONSTRAINT "ProposalTemplate_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Add templateId column to Proposal
ALTER TABLE "Proposal"
    ADD COLUMN IF NOT EXISTS "templateId" TEXT;

CREATE INDEX IF NOT EXISTS "Proposal_templateId_idx" ON "Proposal"("templateId");

ALTER TABLE "Proposal"
    ADD CONSTRAINT "Proposal_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "ProposalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Seed new template permissions into Permission table
INSERT INTO "Permission" ("id", "code", "name", "module", "description")
VALUES
  (gen_random_uuid()::text, 'proposals.template.view',   'View Proposal Templates',   'proposals', 'Can view list of proposal PDF templates'),
  (gen_random_uuid()::text, 'proposals.template.create', 'Create Proposal Template',  'proposals', 'Can upload and configure proposal PDF templates'),
  (gen_random_uuid()::text, 'proposals.template.update', 'Update Proposal Template',  'proposals', 'Can edit proposal template settings and positions'),
  (gen_random_uuid()::text, 'proposals.template.delete', 'Delete Proposal Template',  'proposals', 'Can delete proposal PDF templates')
ON CONFLICT ("code") DO NOTHING;