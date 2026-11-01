import prisma from '@/lib/db/prisma';

export const DEFAULT_ORGANIZATION_AI_POLICY = {
  monthlyRequestLimit: null as number | null,
  monthlyCostLimitUsd: null as number | null,
  monthlySearchRequestLimit: null as number | null,
  monthlySearchCostLimitUsd: null as number | null,
  maxConcurrentDiscoveries: 2,
  allowPlatformProviders: true,
  allowOrganizationProviders: true,
};

export async function getOrganizationAiUsagePolicy(organizationId: string) {
  try {
    const policy = await prisma.organizationAiUsagePolicy.findUnique({ where: { organizationId } });
    return policy ? { monthlyRequestLimit: policy.monthlyRequestLimit, monthlyCostLimitUsd: policy.monthlyCostLimitUsd, monthlySearchRequestLimit: policy.monthlySearchRequestLimit, monthlySearchCostLimitUsd: policy.monthlySearchCostLimitUsd, maxConcurrentDiscoveries: policy.maxConcurrentDiscoveries, allowPlatformProviders: policy.allowPlatformProviders, allowOrganizationProviders: policy.allowOrganizationProviders } : DEFAULT_ORGANIZATION_AI_POLICY;
  } catch {
    return DEFAULT_ORGANIZATION_AI_POLICY;
  }
}

function monthStart() {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function assertOrganizationAiRequestAllowed(organizationId: string) {
  const policy = await getOrganizationAiUsagePolicy(organizationId);
  if (policy.monthlyRequestLimit == null && policy.monthlyCostLimitUsd == null) return;
  const aggregate = await prisma.aiGatewayUsageLog.aggregate({ where: { organizationId, createdAt: { gte: monthStart() } }, _count: { _all: true }, _sum: { estimatedCostUsd: true } });
  if (policy.monthlyRequestLimit != null && aggregate._count._all >= policy.monthlyRequestLimit) throw new Error('The organization AI request limit for this month has been reached.');
  if (policy.monthlyCostLimitUsd != null && aggregate._sum.estimatedCostUsd != null && aggregate._sum.estimatedCostUsd >= policy.monthlyCostLimitUsd) throw new Error('The organization AI budget for this month has been reached.');
}

export async function assertOrganizationDiscoveryCapacity(organizationId: string) {
  const policy = await getOrganizationAiUsagePolicy(organizationId);
  const running = await prisma.leadDiscoveryJob.count({ where: { organizationId, status: { in: ['PENDING', 'RUNNING'] } } });
  if (running >= policy.maxConcurrentDiscoveries) throw new Error('The maximum number of concurrent discovery searches for this organization has been reached.');
}

export async function assertOrganizationSearchRequestAllowed(organizationId: string) {
  const policy = await getOrganizationAiUsagePolicy(organizationId);
  if (policy.monthlySearchRequestLimit == null && policy.monthlySearchCostLimitUsd == null) return;
  const aggregate = await prisma.searchProviderUsageLog.aggregate({ where: { organizationId, status: { not: 'CACHED' }, createdAt: { gte: monthStart() } }, _count: { _all: true }, _sum: { estimatedCostUsd: true } });
  if (policy.monthlySearchRequestLimit != null && aggregate._count._all >= policy.monthlySearchRequestLimit) throw new Error('The organization search request limit for this month has been reached.');
  if (policy.monthlySearchCostLimitUsd != null && aggregate._sum.estimatedCostUsd != null && aggregate._sum.estimatedCostUsd >= policy.monthlySearchCostLimitUsd) throw new Error('The organization search budget for this month has been reached.');
}
