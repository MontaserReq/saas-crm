-- Canonical tenant-admin controls for the dedicated Integrations area.
-- Keep the legacy email integration permissions for backwards compatibility.
INSERT INTO "Permission" ("id", "code", "name", "module", "description")
VALUES
  ('permission_integrations_view', 'integrations.view', 'Integrations view', 'integrations', 'View the organization integrations area'),
  ('permission_integrations_manage', 'integrations.manage', 'Integrations manage', 'integrations', 'Connect, configure and disconnect organization integrations')
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description";

-- Existing system administrators receive the new controls. Custom roles remain
-- unchanged and can be granted/revoked from Admin > Roles.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT
  'roleperm_integrations_' || lower(r."name") || '_' || p."code",
  r."id",
  p."id"
FROM "Role" r
JOIN "Permission" p ON p."code" IN ('integrations.view', 'integrations.manage')
WHERE r."name" IN ('PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
