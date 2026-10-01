import prisma from '../src/lib/db/prisma';
import { UserSession } from '../src/types';
import { CustomFieldService } from '../src/server/services/CustomFieldService';
import { OrganizationConfigService } from '../src/server/services/OrganizationConfigService';

const results: Record<string, string> = {};
const pass = (name: string, value: boolean) => { results[name] = value ? 'PASS' : 'FAIL'; };
async function denied(name: string, action: () => Promise<unknown>) { try { await action(); results[name] = 'FAIL'; } catch { results[name] = 'PASS'; } }

async function main() {
  const [orgA, orgB, deptA, deptB, userA, userB] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: 'tenant-org-a' } }), prisma.organization.findUniqueOrThrow({ where: { id: 'tenant-org-b' } }),
    prisma.department.findUniqueOrThrow({ where: { id: 'tenant-dept-a' } }), prisma.department.findUniqueOrThrow({ where: { id: 'tenant-dept-b' } }),
    prisma.user.findUniqueOrThrow({ where: { id: 'tenant-user-a' } }), prisma.user.findUniqueOrThrow({ where: { id: 'tenant-user-b' } }),
  ]);
  const session = (u: typeof userA, organizationId: string, departmentId: string): UserSession => ({ id: u.id, name: u.name, email: u.email, role: 'SUPER_ADMIN', roleDisplayName: 'Super Admin', departmentId, departmentName: departmentId === deptA.id ? deptA.name : deptB.name, organizationId, permissions: [] });
  const a = session(userA, orgA.id, deptA.id); const b = session(userB, orgB.id, deptB.id); const suffix = Date.now().toString();
  const field = await CustomFieldService.createDefinition(a, { entityType: 'CLIENT', key: `segment_${suffix}`, label: 'Segment', fieldType: 'SELECT', options: ['SMB', 'ENTERPRISE'], searchable: true });
  const other = await CustomFieldService.listDefinitions(b, 'CLIENT');
  pass('custom_fields.tenant_isolation', !other.some((x) => x.id === field.id));
  await denied('custom_fields.cross_org_archive', () => CustomFieldService.archiveDefinition(b, field.id));
  const clientA = await prisma.client.findFirstOrThrow({ where: { organizationId: orgA.id, deletedAt: null } });
  const clientB = await prisma.client.findFirstOrThrow({ where: { organizationId: orgB.id, deletedAt: null } });
  await CustomFieldService.setValues(a, 'CLIENT', clientA.id, { [field.key]: 'SMB' });
  pass('custom_values.own_write', (await CustomFieldService.getEntityValues(a, 'CLIENT', clientA.id)).some((x) => x.valueText === 'SMB'));
  await denied('custom_values.cross_org_entity', () => CustomFieldService.setValues(a, 'CLIENT', clientB.id, { [field.key]: 'SMB' }));
  await denied('custom_values.invalid_select', () => CustomFieldService.setValues(a, 'CLIENT', clientA.id, { [field.key]: 'INVALID' }));
  const required = await CustomFieldService.createDefinition(a, { entityType: 'CLIENT', key: `required_${suffix}`, label: 'Required', fieldType: 'TEXT', required: true });
  await denied('custom_values.required_enforced', () => CustomFieldService.setValues(a, 'CLIENT', clientA.id, {}));
  await CustomFieldService.setValues(a, 'CLIENT', clientA.id, { [required.key]: 'present' });
  pass('custom_values.required_write', (await CustomFieldService.getEntityValues(a, 'CLIENT', clientA.id)).some((x) => x.fieldDefinitionId === required.id));
  const cfgA = await OrganizationConfigService.get(a); const cfgB = await OrganizationConfigService.get(b);
  await OrganizationConfigService.updateLists(a, { clientTypes: ['SCHOOL', 'PARTNER'], leadStatuses: ['NEW', 'QUALIFIED'] });
  const cfgB2 = await OrganizationConfigService.get(b);
  pass('organization_config.tenant_isolation', JSON.stringify(cfgB.settings.clientTypes) === JSON.stringify(cfgB2.settings.clientTypes) && !cfgB2.settings.clientTypes.includes('PARTNER'));
  await denied('organization_config.invalid_timezone', () => OrganizationConfigService.updateOrganization(a, { timezone: 'Not/AZone' }));
  await OrganizationConfigService.updateOrganization(a, { language: 'ar', currency: 'JOD', timezone: 'Asia/Amman' });
  const updatedA = await OrganizationConfigService.get(a);
  pass('organization_config.org_preferences', updatedA.organization.language === 'ar' && updatedA.organization.currency === 'JOD' && updatedA.organization.timezone === 'Asia/Amman');
  await CustomFieldService.archiveDefinition(a, field.id); pass('custom_fields.soft_archive', !(await CustomFieldService.listDefinitions(a, 'CLIENT')).some((x) => x.id === field.id));
  const nullDefs = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*)::bigint AS count FROM "CustomFieldDefinition" WHERE "organizationId" IS NULL');
  const nullValues = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*)::bigint AS count FROM "CustomFieldValue" WHERE "organizationId" IS NULL');
  pass('custom_fields.ownership_nulls', Number(nullDefs[0].count) === 0 && Number(nullValues[0].count) === 0);
  console.log(JSON.stringify({ results, pass: Object.values(results).filter(x => x === 'PASS').length, fail: Object.values(results).filter(x => x === 'FAIL').length }));
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
