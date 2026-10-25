-- Existing organization configuration already reads this setting, but its
-- original schema addition had no migration. Preserve populated deployments.
ALTER TABLE "OrganizationSettings" ADD COLUMN IF NOT EXISTS "ticketPriorities" TEXT NOT NULL DEFAULT '[]';
