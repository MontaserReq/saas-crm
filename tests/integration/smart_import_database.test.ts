import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadEnvConfig } from '@next/env';
import { randomUUID } from 'node:crypto';
import prisma from '@/lib/db/prisma';
import type { UserSession } from '@/types';

vi.mock('server-only', () => ({}));
import { DataImportService } from '@/server/services/DataImportService';

const run = process.env.RUN_SMART_IMPORT_DB === '1';
if (run) loadEnvConfig(process.cwd());
const suffix = randomUUID();
const orgIds: string[] = [];
const userIds: string[] = [];
let tenantA: UserSession;
let tenantB: UserSession;

async function tenant(label: string, roleId: string): Promise<UserSession> {
  const organization = await prisma.organization.create({ data: { name: `Import QA ${label}`, slug: `import-qa-${suffix}-${label}`, currency: 'JOD' } });
  orgIds.push(organization.id);
  const department = await prisma.department.create({ data: { organizationId: organization.id, name: 'QA', code: `IMPORT_QA_${suffix}_${label}` } });
  const user = await prisma.user.create({ data: { name: `Import QA ${label}`, email: `import-${suffix}-${label}@example.test`, passwordHash: 'not-for-login', roleId, departmentId: department.id, organizationMemberships: { create: { organizationId: organization.id, roleId } } } });
  userIds.push(user.id);
  return { id: user.id, name: user.name, email: user.email, role: 'ADMIN', roleDisplayName: 'Admin', departmentId: department.id, departmentName: department.name, permissions: [], organizationId: organization.id };
}

describe.skipIf(!run)('Smart import PostgreSQL execution and isolation', () => {
  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) throw new Error('Integration tests require a local PostgreSQL database');
    const role = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
    tenantA = await tenant('a', role.id);
    tenantB = await tenant('b', role.id);
  }, 30_000);

  afterAll(async () => {
    const where = { organizationId: { in: orgIds } };
    await prisma.dataImport.deleteMany({ where });
    await prisma.auditLog.deleteMany({ where });
    await prisma.customFieldDefinition.deleteMany({ where });
    await prisma.client.deleteMany({ where });
    await prisma.organizationMember.deleteMany({ where });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.department.deleteMany({ where });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.$disconnect();
  }, 30_000);

  it('creates records and custom fields atomically, isolates tenants, and replays safely', async () => {
    const draft = await DataImportService.createDraft(tenantA, {
      filename: 'clients.csv', sheetName: 'Sheet1', headers: ['Customer Name', 'Email', 'Renewal'],
      rows: [{ 'Customer Name': 'Acme', Email: 'owner@acme.test', Renewal: '2027-03-01' }], destination: 'CLIENT', recommendedDestination: 'CLIENT',
    });
    const input = { destination: 'CLIENT', mode: 'UPSERT', matchField: 'email', mappings: [
      { source: 'Customer Name', action: 'FIELD', target: 'name' },
      { source: 'Email', action: 'FIELD', target: 'email' },
      { source: 'Renewal', action: 'CUSTOM', customLabel: 'Contract Renewal Date', customType: 'DATE', searchable: true },
    ] } as const;
    const preview = await DataImportService.buildPreview(tenantA, draft.id, input as any, true);
    expect(preview.summary).toMatchObject({ create: 1, update: 0, reject: 0 });
    await expect(DataImportService.getOwned(tenantB, draft.id)).rejects.toThrow('not found');
    const first = await DataImportService.confirm(tenantA, draft.id, 'integrationkey0001', true);
    expect(first).toMatchObject({ imported: 1, updated: 0, failed: 0, status: 'COMPLETED' });
    expect(await prisma.client.count({ where: { organizationId: tenantA.organizationId, email: 'owner@acme.test' } })).toBe(1);
    expect(await prisma.client.count({ where: { organizationId: tenantB.organizationId } })).toBe(0);
    const definition = await prisma.customFieldDefinition.findFirstOrThrow({ where: { organizationId: tenantA.organizationId, entityType: 'CLIENT', label: 'Contract Renewal Date' } });
    expect(definition).toMatchObject({ fieldType: 'DATE', searchable: true });
    expect((await prisma.customFieldValue.findFirstOrThrow({ where: { organizationId: tenantA.organizationId, fieldDefinitionId: definition.id } })).valueDate).toBeInstanceOf(Date);
    expect(await DataImportService.confirm(tenantA, draft.id, 'integrationkey0001', true)).toMatchObject({ replayed: true, imported: 1 });
    expect(await prisma.client.count({ where: { organizationId: tenantA.organizationId, email: 'owner@acme.test' } })).toBe(1);
  });

  it('updates only mapped fields and reports duplicate uploaded rows without guessing', async () => {
    const existing = await prisma.client.findFirstOrThrow({ where: { organizationId: tenantA.organizationId, email: 'owner@acme.test' } });
    await prisma.client.update({ where: { id: existing.id }, data: { phone: '+962790000000', type: 'COMPANY' } });
    const draft = await DataImportService.createDraft(tenantA, {
      filename: 'update.csv', sheetName: 'Sheet1', headers: ['Name', 'Email'],
      rows: [{ Name: 'Acme Updated', Email: 'owner@acme.test' }, { Name: 'Repeated', Email: 'owner@acme.test' }], destination: 'CLIENT', recommendedDestination: 'CLIENT',
    });
    const input = { destination: 'CLIENT', mode: 'UPDATE', matchField: 'email', mappings: [
      { source: 'Name', action: 'FIELD', target: 'name' }, { source: 'Email', action: 'FIELD', target: 'email' },
    ] } as const;
    const preview = await DataImportService.buildPreview(tenantA, draft.id, input as any, false);
    expect(preview.summary).toMatchObject({ update: 1, reject: 1, duplicateRows: 1 });
    const result = await DataImportService.confirm(tenantA, draft.id, 'integrationkey0002', false);
    expect(result).toMatchObject({ updated: 1, failed: 1, status: 'PARTIAL' });
    expect(await prisma.client.findUniqueOrThrow({ where: { id: existing.id } })).toMatchObject({ name: 'Acme Updated', phone: '+962790000000', type: 'COMPANY' });
  });
});
