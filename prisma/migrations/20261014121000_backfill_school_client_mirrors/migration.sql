-- Backfill the established compatibility convention: a School and its Client
-- mirror share the same primary key. Null-tenant schools cannot be inserted
-- into Client safely and remain an explicit production data-audit prerequisite.
BEGIN;

LOCK TABLE "School", "Client" IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "School" school
    JOIN "Client" client ON client."id" = school."id"
    WHERE school."organizationId" IS NOT NULL
      AND client."organizationId" <> school."organizationId"
  ) THEN
    RAISE EXCEPTION 'A School/Client id collision exists across organizations';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "School" school
    JOIN "Client" client ON client."id" = school."id"
    WHERE school."organizationId" IS NOT NULL
      AND client."organizationId" = school."organizationId"
      AND client."type" <> 'SCHOOL'
  ) THEN
    RAISE EXCEPTION 'An existing School mirror id is assigned to a non-school Client';
  END IF;
END $$;

INSERT INTO "Client" (
  "id", "organizationId", "name", "type", "status", "description",
  "email", "phone", "address", "logoKey", "logoProvider",
  "createdById", "deletedAt", "createdAt", "updatedAt"
)
SELECT
  school."id",
  school."organizationId",
  school."name",
  'SCHOOL',
  CASE
    WHEN school."isDeleted" OR school."deletedAt" IS NOT NULL THEN 'ARCHIVED'
    WHEN school."status" = 'INACTIVE' THEN 'INACTIVE'
    ELSE 'ACTIVE'
  END,
  school."notes",
  school."email",
  school."phone",
  NULLIF(concat_ws(', ', NULLIF(school."area", ''), NULLIF(school."city", '')), ''),
  school."logoKey",
  school."logoProvider",
  school."createdById",
  school."deletedAt",
  school."createdAt",
  school."updatedAt"
FROM "School" school
WHERE school."organizationId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Client" client WHERE client."id" = school."id");

COMMIT;
