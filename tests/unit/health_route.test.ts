import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/lib/db/prisma', () => ({ default: { $queryRaw: query } }));

import { GET } from '@/app/api/health/route';

describe('health endpoint', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports ready without exposing infrastructure details', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('fails closed when the database is unavailable', async () => {
    query.mockRejectedValue(new Error('credential and hostname details must not leak'));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });
});
