import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  organizationAiUsagePolicy: { findUnique: vi.fn() },
  aiGatewayUsageLog: { aggregate: vi.fn() },
  leadDiscoveryJob: { count: vi.fn() },
}));

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }));

import { assertOrganizationAiRequestAllowed, assertOrganizationDiscoveryCapacity, getOrganizationAiUsagePolicy } from '@/lib/ai/organizationPolicy';

describe('organization AI policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.organizationAiUsagePolicy.findUnique.mockResolvedValue(null);
    prismaMock.aiGatewayUsageLog.aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { estimatedCostUsd: null } });
    prismaMock.leadDiscoveryJob.count.mockResolvedValue(0);
  });

  it('defaults to permissive policy when no override is configured', async () => {
    await expect(getOrganizationAiUsagePolicy('org-1')).resolves.toMatchObject({ allowPlatformProviders: true, allowOrganizationProviders: true, maxConcurrentDiscoveries: 2 });
    await expect(assertOrganizationAiRequestAllowed('org-1')).resolves.toBeUndefined();
  });

  it('enforces monthly request limits', async () => {
    prismaMock.organizationAiUsagePolicy.findUnique.mockResolvedValue({ monthlyRequestLimit: 2, monthlyCostLimitUsd: null, maxConcurrentDiscoveries: 2, allowPlatformProviders: true, allowOrganizationProviders: true });
    prismaMock.aiGatewayUsageLog.aggregate.mockResolvedValue({ _count: { _all: 2 }, _sum: { estimatedCostUsd: null } });
    await expect(assertOrganizationAiRequestAllowed('org-1')).rejects.toThrow('request limit');
  });

  it('enforces discovery concurrency limits', async () => {
    prismaMock.organizationAiUsagePolicy.findUnique.mockResolvedValue({ monthlyRequestLimit: null, monthlyCostLimitUsd: null, maxConcurrentDiscoveries: 1, allowPlatformProviders: true, allowOrganizationProviders: true });
    prismaMock.leadDiscoveryJob.count.mockResolvedValue(1);
    await expect(assertOrganizationDiscoveryCapacity('org-1')).rejects.toThrow('concurrent discovery');
  });
});
