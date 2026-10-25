// Fixed capabilities for a newly registered workspace owner. Never supplied by
// the client and never include platform authority or global role management.
// Use existing per-user grants so shared roles of existing tenants stay intact.
export const WORKSPACE_OWNER_PERMISSIONS = [
  'users.create',
  'organization_settings.view', 'organization_settings.manage',
  'custom_fields.view', 'custom_fields.create', 'custom_fields.update', 'custom_fields.delete',
  'deals.view', 'deals.create', 'deals.update', 'deals.delete',
  'pipelines.view', 'pipelines.manage',
  'tasks.view', 'tasks.create', 'tasks.update', 'tasks.delete',
  'proposals.view', 'proposals.create', 'proposals.update', 'proposals.delete', 'proposals.generate',
  'proposals.template.view', 'proposals.template.create', 'proposals.template.update', 'proposals.template.delete',
] as const;
