INSERT INTO "Permission" ("id", "code", "name", "module", "description")
VALUES
  (gen_random_uuid()::text, 'messages.groups.view', 'messages groups view', 'messages', 'messages groups view'),
  (gen_random_uuid()::text, 'messages.groups.create', 'messages groups create', 'messages', 'messages groups create'),
  (gen_random_uuid()::text, 'messages.groups.update', 'messages groups update', 'messages', 'messages groups update'),
  (gen_random_uuid()::text, 'messages.groups.delete', 'messages groups delete', 'messages', 'messages groups delete')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE p."code" = 'messages.groups.view'
  AND r."name" IN ('PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'SCHOOL_MANAGER', 'MEMBER')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE p."code" IN ('messages.groups.create', 'messages.groups.update', 'messages.groups.delete')
  AND r."name" IN ('PLATFORM_ADMIN', 'SUPER_ADMIN')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
