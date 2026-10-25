import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const { prismaMock } = vi.hoisted(() => {
  const prismaMock: any = {
    school: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    client: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (operation: any) => operation(prismaMock));
  return { prismaMock };
});
vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));
vi.mock('@/lib/auth/organization', () => ({ requireOrganizationIdForUserId: async () => 'org-a', requireOrganizationId: () => 'org-a' }));
vi.mock('@/server/services/AuditService', () => ({ AuditService: { logAudit: vi.fn() } }));

import { SchoolService } from '@/server/services/SchoolService';

const school = { id: 'school-a', name: 'Synthetic School', city: 'Amman', area: null, phone: null, email: null, notes: null, status: 'ACTIVE', logoKey: null, logoProvider: 'local', responsibleEmployeeId: null };

describe('School to Client compatibility integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.school.create.mockResolvedValue(school);
    prismaMock.school.findFirst.mockResolvedValue(school);
    prismaMock.school.update.mockResolvedValue(school);
    prismaMock.client.findUnique.mockResolvedValue(null);
    prismaMock.client.create.mockResolvedValue({ id: school.id });
    prismaMock.client.update.mockResolvedValue({ id: school.id });
  });

  it('creates the Client mirror in the same transaction using the School id', async () => {
    await SchoolService.createSchool({ name: school.name, city: school.city }, 'actor-a');
    expect(prismaMock.client.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: school.id, organizationId: 'org-a', type: 'SCHOOL' }),
    });
  });

  it('updates an existing compatible mirror idempotently', async () => {
    prismaMock.client.findUnique.mockResolvedValue({ organizationId: 'org-a', type: 'SCHOOL' });
    await SchoolService.updateSchool(school.id, { name: school.name, city: school.city }, 'actor-a');
    expect(prismaMock.client.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.client.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: school.id } }));
    expect(prismaMock.client.create).not.toHaveBeenCalled();
  });

  it('never repurposes a Client id owned by another tenant', async () => {
    prismaMock.client.findUnique.mockResolvedValue({ organizationId: 'org-b', type: 'SCHOOL' });
    await expect(SchoolService.updateSchool(school.id, { name: school.name, city: school.city }, 'actor-a')).rejects.toThrow(/another organization/i);
    expect(prismaMock.client.create).not.toHaveBeenCalled();
    expect(prismaMock.client.update).not.toHaveBeenCalled();
  });

  it('never converts a same-tenant non-school Client into a School mirror', async () => {
    prismaMock.client.findUnique.mockResolvedValue({ organizationId: 'org-a', type: 'COMPANY' });
    await expect(SchoolService.updateSchool(school.id, { name: school.name, city: school.city }, 'actor-a')).rejects.toThrow(/non-school Client/i);
    expect(prismaMock.client.create).not.toHaveBeenCalled();
    expect(prismaMock.client.update).not.toHaveBeenCalled();
  });

  it('fails closed on a concurrent same-id Client insertion instead of updating it', async () => {
    prismaMock.client.create.mockRejectedValueOnce(new Error('Unique constraint failed on Client.id'));
    await expect(SchoolService.createSchool({ name: school.name, city: school.city }, 'actor-a')).rejects.toThrow(/unique constraint/i);
    expect(prismaMock.client.update).not.toHaveBeenCalled();
  });

  it('wires bulk imports and their generated tickets to the same Client mirror', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../src/server/services/SchoolService.ts'), 'utf8');
    expect(source).toMatch(/await this\.ensureClientMirror\(tx, school, actorId, organizationId\)/);
    expect(source).toMatch(/clientId: school\.id/);
  });

  it('provides a forward-only historical backfill with conflict guards', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261014121000_backfill_school_client_mirrors/migration.sql'), 'utf8');
    expect(sql).toMatch(/INSERT INTO "Client"/);
    expect(sql).toMatch(/school\."organizationId" IS NOT NULL/);
    expect(sql).toMatch(/School\/Client id collision exists across organizations/);
    expect(sql).toMatch(/client\."type" <> 'SCHOOL'/);

    const ticketSql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261014122000_repair_unambiguous_school_ticket_clients/migration.sql'), 'utf8');
    expect(ticketSql).toMatch(/ticket\."clientId" IS NULL/);
    expect(ticketSql).toMatch(/ticket\."organizationId" = school\."organizationId"/);
    expect(ticketSql).toMatch(/client\."organizationId" = school\."organizationId"/);
    expect(ticketSql).toMatch(/client\."type" = 'SCHOOL'/);
  });
});
