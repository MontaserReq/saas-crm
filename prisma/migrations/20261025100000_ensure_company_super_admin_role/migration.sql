-- Public signup requires a tenant-scoped Company Super Admin role.
-- Keep this migration idempotent so existing installations are repaired safely.
INSERT INTO "Role" ("id", "name", "displayName", "description", "isSystem", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'SUPER_ADMIN',
  'Company Super Admin',
  'Highest administrator inside one company',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "description" = EXCLUDED."description",
  "isSystem" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'SUPER_ADMIN'
  AND permission."code" IN (
    'users.create',
    'organization_settings.view',
    'organization_settings.manage',
    'custom_fields.view',
    'custom_fields.create',
    'custom_fields.update',
    'custom_fields.delete',
    'deals.view',
    'deals.create',
    'deals.update',
    'deals.delete',
    'pipelines.view',
    'pipelines.manage',
    'tasks.view',
    'tasks.create',
    'tasks.update',
    'tasks.delete',
    'proposals.view',
    'proposals.create',
    'proposals.update',
    'proposals.delete',
    'proposals.generate',
    'proposals.template.view',
    'proposals.template.create',
    'proposals.template.update',
    'proposals.template.delete'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
