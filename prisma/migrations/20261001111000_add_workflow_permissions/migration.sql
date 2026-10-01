INSERT INTO "Permission" ("id", "code", "name", "module", "description") VALUES
(gen_random_uuid()::text,'workflows.view','View Workflows','workflows','View tenant workflows'),
(gen_random_uuid()::text,'workflows.create','Create Workflows','workflows','Create tenant workflows'),
(gen_random_uuid()::text,'workflows.update','Update Workflows','workflows','Edit tenant workflows'),
(gen_random_uuid()::text,'workflows.activate','Activate Workflows','workflows','Activate or deactivate workflows'),
(gen_random_uuid()::text,'workflows.execute','Execute Workflows','workflows','Run workflow execution actions'),
(gen_random_uuid()::text,'workflows.archive','Archive Workflows','workflows','Archive workflows'),
(gen_random_uuid()::text,'workflows.executions.view','View Workflow Executions','workflows','Inspect workflow execution history')
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("id","roleId","permissionId") SELECT gen_random_uuid()::text,r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."name" IN ('ADMIN','SUPER_ADMIN','SCHOOL_MANAGER') AND p."code" IN ('workflows.view','workflows.create','workflows.update','workflows.activate','workflows.execute','workflows.archive','workflows.executions.view') ON CONFLICT ("roleId","permissionId") DO NOTHING;
