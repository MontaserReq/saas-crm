-- Separate global platform authority from the highest organization role.
INSERT INTO "Role" ("id", "name", "displayName", "description", "isSystem", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'PLATFORM_ADMIN', 'Platform Admin', 'Global platform administrator', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "description" = EXCLUDED."description",
  "isSystem" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Platform Admin receives the existing full permission catalog.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, platform_role."id", source_permission."permissionId"
FROM "Role" platform_role
JOIN "Role" source_role ON source_role."name" = 'SUPER_ADMIN'
JOIN "RolePermission" source_permission ON source_permission."roleId" = source_role."id"
WHERE platform_role."name" = 'PLATFORM_ADMIN'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Move only explicitly marked platform accounts and their active membership.
UPDATE "User" platform_user
SET "roleId" = platform_role."id"
FROM "Role" platform_role
WHERE platform_role."name" = 'PLATFORM_ADMIN'
  AND platform_user."isPlatformAdmin" = true;

UPDATE "OrganizationMember" membership
SET "roleId" = platform_role."id"
FROM "Role" platform_role, "User" platform_user
WHERE platform_role."name" = 'PLATFORM_ADMIN'
  AND platform_user."id" = membership."userId"
  AND platform_user."isPlatformAdmin" = true;

-- SUPER_ADMIN is now tenant-scoped and represents the company owner/highest administrator.
UPDATE "Role"
SET "displayName" = 'Company Super Admin',
    "description" = 'Highest administrator inside one company',
    "isSystem" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'SUPER_ADMIN';

-- Promote owners created by the onboarding flow without changing ordinary ADMIN users.
UPDATE "OrganizationMember" membership
SET "roleId" = company_role."id"
FROM "Role" company_role, "OrganizationSettings" settings, "User" owner
WHERE company_role."name" = 'SUPER_ADMIN'
  AND settings."organizationId" = membership."organizationId"
  AND owner."id" = membership."userId"
  AND owner."isPlatformAdmin" = false
  AND POSITION('"ownerId":"' || membership."userId" || '"' IN COALESCE(settings."onboardingState", '')) > 0;

UPDATE "User" owner
SET "roleId" = company_role."id"
FROM "Role" company_role
WHERE company_role."name" = 'SUPER_ADMIN'
  AND owner."isPlatformAdmin" = false
  AND EXISTS (
    SELECT 1
    FROM "OrganizationMember" membership
    JOIN "OrganizationSettings" settings ON settings."organizationId" = membership."organizationId"
    WHERE membership."userId" = owner."id"
      AND POSITION('"ownerId":"' || owner."id" || '"' IN COALESCE(settings."onboardingState", '')) > 0
  );
