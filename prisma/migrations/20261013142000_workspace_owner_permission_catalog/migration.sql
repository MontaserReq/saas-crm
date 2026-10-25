-- Some legacy seed runs replaced the catalog after sales/configuration migrations.
-- Restore supported capability records only. Signup assigns a fixed allowlist
-- to its new owner via UserPermission; existing shared roles are unchanged.
INSERT INTO "Permission" ("id", "code", "name", "module", "description") VALUES
(gen_random_uuid()::text, 'users.create', 'users create', 'users', 'users create'),
(gen_random_uuid()::text, 'organization_settings.view', 'organization settings view', 'organization_settings', 'organization settings view'),
(gen_random_uuid()::text, 'organization_settings.manage', 'organization settings manage', 'organization_settings', 'organization settings manage'),
(gen_random_uuid()::text, 'custom_fields.view', 'custom fields view', 'custom_fields', 'custom fields view'),
(gen_random_uuid()::text, 'custom_fields.create', 'custom fields create', 'custom_fields', 'custom fields create'),
(gen_random_uuid()::text, 'custom_fields.update', 'custom fields update', 'custom_fields', 'custom fields update'),
(gen_random_uuid()::text, 'custom_fields.delete', 'custom fields delete', 'custom_fields', 'custom fields delete'),
(gen_random_uuid()::text, 'deals.view', 'deals view', 'deals', 'deals view'),
(gen_random_uuid()::text, 'deals.create', 'deals create', 'deals', 'deals create'),
(gen_random_uuid()::text, 'deals.update', 'deals update', 'deals', 'deals update'),
(gen_random_uuid()::text, 'deals.delete', 'deals delete', 'deals', 'deals delete'),
(gen_random_uuid()::text, 'pipelines.view', 'pipelines view', 'pipelines', 'pipelines view'),
(gen_random_uuid()::text, 'pipelines.manage', 'pipelines manage', 'pipelines', 'pipelines manage'),
(gen_random_uuid()::text, 'tasks.view', 'tasks view', 'tasks', 'tasks view'),
(gen_random_uuid()::text, 'tasks.create', 'tasks create', 'tasks', 'tasks create'),
(gen_random_uuid()::text, 'tasks.update', 'tasks update', 'tasks', 'tasks update'),
(gen_random_uuid()::text, 'tasks.delete', 'tasks delete', 'tasks', 'tasks delete'),
(gen_random_uuid()::text, 'proposals.view', 'proposals view', 'proposals', 'proposals view'),
(gen_random_uuid()::text, 'proposals.create', 'proposals create', 'proposals', 'proposals create'),
(gen_random_uuid()::text, 'proposals.update', 'proposals update', 'proposals', 'proposals update'),
(gen_random_uuid()::text, 'proposals.delete', 'proposals delete', 'proposals', 'proposals delete'),
(gen_random_uuid()::text, 'proposals.generate', 'proposals generate', 'proposals', 'proposals generate'),
(gen_random_uuid()::text, 'proposals.template.view', 'proposals template view', 'proposals', 'proposals template view'),
(gen_random_uuid()::text, 'proposals.template.create', 'proposals template create', 'proposals', 'proposals template create'),
(gen_random_uuid()::text, 'proposals.template.update', 'proposals template update', 'proposals', 'proposals template update'),
(gen_random_uuid()::text, 'proposals.template.delete', 'proposals template delete', 'proposals', 'proposals template delete')
ON CONFLICT ("code") DO NOTHING;
