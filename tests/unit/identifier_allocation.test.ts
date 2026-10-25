import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { nextAssignmentBatchNumber, nextTicketNumber } from '@/lib/identifiers';

describe('database-backed public identifiers', () => {
  it('uses unique sequence values under concurrent allocation', async () => {
    let value = 1000n;
    const client = { $queryRaw: vi.fn(async () => [{ value: ++value }]) } as any;
    const values = await Promise.all(Array.from({ length: 50 }, () => nextTicketNumber(client)));
    expect(new Set(values).size).toBe(50);
    expect(values[0]).toBe('CL-01001');
  });

  it('does not include tenant-local counts in assignment identifiers', async () => {
    const client = { $queryRaw: vi.fn(async () => [{ value: 7n }]) } as any;
    await expect(nextAssignmentBatchNumber(client, new Date('2026-10-14T00:00:00Z'))).resolves.toBe('ASN-2026-0007');
  });

  it('keeps database uniqueness and legacy-null protection in the forward migration', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261014120000_secure_tenant_identifiers/migration.sql'), 'utf8');
    expect(sql).toMatch(/CREATE SEQUENCE IF NOT EXISTS "TicketNumberSequence"/);
    expect(sql).toMatch(/Department_organizationId_code_key/);
    expect(sql).toMatch(/WHERE "organizationId" IS NULL/);
    expect(sql).toMatch(/RAISE EXCEPTION 'Duplicate Department codes/);
  });
});
