-- Repair only historical ticket links whose existing School/Client mirror is
-- unambiguous. Null-tenant rows and any ownership/type collision are left
-- unchanged for a manual production data review.
BEGIN;

LOCK TABLE "Ticket", "School", "Client" IN SHARE ROW EXCLUSIVE MODE;

UPDATE "Ticket" ticket
SET "clientId" = ticket."schoolId",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "School" school
JOIN "Client" client
  ON client."id" = school."id"
 AND client."organizationId" = school."organizationId"
 AND client."type" = 'SCHOOL'
WHERE ticket."clientId" IS NULL
  AND ticket."schoolId" = school."id"
  AND ticket."organizationId" IS NOT NULL
  AND school."organizationId" IS NOT NULL
  AND ticket."organizationId" = school."organizationId";

COMMIT;
