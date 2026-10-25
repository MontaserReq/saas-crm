-- Database-backed allocation preserves historical identifiers while making
-- concurrent and cross-tenant creation collision-safe.
-- Deployment prerequisite: pause ticket/assignment writes until this migration
-- and the sequence-backed application code are both active.
BEGIN;

LOCK TABLE "Ticket", "SchoolAssignment", "Department", "TaskType", "MessageTemplate"
  IN SHARE ROW EXCLUSIVE MODE;

CREATE SEQUENCE IF NOT EXISTS "TicketNumberSequence";
CREATE SEQUENCE IF NOT EXISTS "AssignmentBatchNumberSequence";

SELECT setval(
  '"TicketNumberSequence"',
  GREATEST(1000, COALESCE((
    SELECT MAX(substring("ticketNumber" from '^CL-([0-9]+)$')::bigint)
    FROM "Ticket" WHERE "ticketNumber" ~ '^CL-[0-9]+$'
  ), 0)),
  true
);

SELECT setval('"AssignmentBatchNumberSequence"', GREATEST(1, existing.maximum), existing.maximum > 0)
FROM (
  SELECT COALESCE(MAX(substring("batchNumber" from '^ASN-[0-9]{4}-([0-9]+)$')::bigint), 0) AS maximum
  FROM "SchoolAssignment" WHERE "batchNumber" ~ '^ASN-[0-9]{4}-[0-9]+$'
) existing;

-- Refuse to alter constraints if existing tenant data would violate them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Department" WHERE "organizationId" IS NOT NULL GROUP BY "organizationId", "code" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate Department codes exist within an organization';
  END IF;
  IF EXISTS (SELECT 1 FROM "TaskType" WHERE "organizationId" IS NOT NULL AND "code" IS NOT NULL GROUP BY "organizationId", "code" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate TaskType codes exist within an organization';
  END IF;
  IF EXISTS (SELECT 1 FROM "MessageTemplate" WHERE "organizationId" IS NOT NULL GROUP BY "organizationId", "code" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate MessageTemplate codes exist within an organization';
  END IF;
END $$;

DROP INDEX IF EXISTS "Department_code_key";
DROP INDEX IF EXISTS "TaskType_code_key";
DROP INDEX IF EXISTS "MessageTemplate_code_key";

CREATE UNIQUE INDEX "Department_organizationId_code_key" ON "Department"("organizationId", "code");
CREATE UNIQUE INDEX "TaskType_organizationId_code_key" ON "TaskType"("organizationId", "code");
CREATE UNIQUE INDEX "MessageTemplate_organizationId_code_key" ON "MessageTemplate"("organizationId", "code");

-- Composite uniqueness permits multiple NULL tenant IDs. Preserve the legacy
-- global invariant for those rows until ownership is backfilled.
CREATE UNIQUE INDEX "Department_legacy_code_key" ON "Department"("code") WHERE "organizationId" IS NULL;
CREATE UNIQUE INDEX "TaskType_legacy_code_key" ON "TaskType"("code") WHERE "organizationId" IS NULL AND "code" IS NOT NULL;
CREATE UNIQUE INDEX "MessageTemplate_legacy_code_key" ON "MessageTemplate"("code") WHERE "organizationId" IS NULL;

COMMIT;
