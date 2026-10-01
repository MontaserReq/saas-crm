INSERT INTO "Permission" ("id", "code", "name", "module", "description") VALUES
  (gen_random_uuid()::text, 'custom_fields.view', 'View Custom Fields', 'configuration', 'View tenant custom field definitions and values'),
  (gen_random_uuid()::text, 'custom_fields.create', 'Create Custom Fields', 'configuration', 'Create tenant custom field definitions'),
  (gen_random_uuid()::text, 'custom_fields.update', 'Update Custom Fields', 'configuration', 'Update tenant custom field definitions'),
  (gen_random_uuid()::text, 'custom_fields.delete', 'Archive Custom Fields', 'configuration', 'Archive tenant custom field definitions'),
  (gen_random_uuid()::text, 'organization_settings.view', 'View Organization Settings', 'configuration', 'View organization configuration'),
  (gen_random_uuid()::text, 'organization_settings.manage', 'Manage Organization Settings', 'configuration', 'Manage organization configuration and CRM lists')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, r."id", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."name" IN ('ADMIN', 'SUPER_ADMIN', 'SCHOOL_MANAGER')
  AND p."code" IN ('custom_fields.view', 'custom_fields.create', 'custom_fields.update', 'custom_fields.delete', 'organization_settings.view', 'organization_settings.manage')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
