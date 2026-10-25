-- Keep the existing role and permissions, but remove the school-specific
-- product wording from the role shown in the CRM interface.
UPDATE "Role"
SET "displayName" = 'Operations Manager',
    "description" = 'Operations manager inside one company',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'SCHOOL_MANAGER';
