import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  client: { count: vi.fn().mockResolvedValue(1) }, lead: { count: vi.fn().mockResolvedValue(1) },
  deal: { count: vi.fn().mockResolvedValue(1), aggregate: vi.fn().mockResolvedValue({ _sum: { value: 100 } }) },
  crmTask: { count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValue([]) },
  auditLog: { findMany: vi.fn().mockResolvedValue([]) }, pipeline: { findMany: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/lib/db/prisma', () => ({ default: mocks }));
vi.mock('@/lib/auth/organization', () => ({ requireOrganizationContext: async () => ({ id: 'tenant' }) }));
import { CrmWorkspaceService } from '@/server/services/CrmWorkspaceService';
import type { UserSession } from '@/types';
const user = { id: 'member', role: 'ADMIN', permissions: [], organizationId: 'tenant' } as unknown as UserSession;
beforeEach(() => vi.clearAllMocks());
describe('Personalized overview respects existing permissions', () => {
  it('does not query inaccessible modules or expose their activity', async () => {
    const data = await CrmWorkspaceService.dashboard(user, ['clients', 'leads', 'deals', 'tasks', 'pipelines']);
    expect(data.counts.clients).toBe(0); expect(data.counts.deals).toBe(0);
    expect(mocks.client.count).not.toHaveBeenCalled(); expect(mocks.deal.aggregate).not.toHaveBeenCalled();
    expect(mocks.crmTask.findMany).not.toHaveBeenCalled(); expect(mocks.pipeline.findMany).not.toHaveBeenCalled();
    expect(mocks.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'tenant', entityType: { in: [] } } }));
  });
  it('queries selected customer modules within the authenticated tenant only', async () => {
    await CrmWorkspaceService.dashboard({ ...user, permissions: ['schools.view'] }, ['clients']);
    expect(mocks.client.count).toHaveBeenCalledWith({ where: { organizationId: 'tenant', deletedAt: null } });
    expect(mocks.lead.count).not.toHaveBeenCalled(); expect(mocks.deal.count).not.toHaveBeenCalled();
  });
});
