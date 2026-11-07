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

/**
 * Safe monthly defaults. The platform admin can override these values through
 * the platform policy, while organizations only receive a read-only view.
 */
const PLAN_QUOTAS: Record<string, {
  monthlyRequestLimit: number | null;
  monthlyCostLimitUsd: number | null;
  monthlySearchRequestLimit: number | null;
  monthlySearchCostLimitUsd: number | null;
}> = {
  starter: { monthlyRequestLimit: 100, monthlyCostLimitUsd: 2, monthlySearchRequestLimit: 0, monthlySearchCostLimitUsd: 0 },
  growth: { monthlyRequestLimit: 1000, monthlyCostLimitUsd: 25, monthlySearchRequestLimit: 500, monthlySearchCostLimitUsd: 10 },
  scale: { monthlyRequestLimit: 5000, monthlyCostLimitUsd: 100, monthlySearchRequestLimit: 2500, monthlySearchCostLimitUsd: 50 },
  enterprise: { monthlyRequestLimit: 20000, monthlyCostLimitUsd: 500, monthlySearchRequestLimit: 10000, monthlySearchCostLimitUsd: 200 },
};

async function getPlanQuota(organizationId: string) {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { platformSubscription: { select: { plan: { select: { slug: true } } } } },
    });
    return PLAN_QUOTAS[(organization?.platformSubscription?.plan.slug || "growth").toLowerCase()] || PLAN_QUOTAS.growth;
  } catch {
    return PLAN_QUOTAS.growth;
  }
}

export async function getOrganizationAiUsagePolicy(organizationId: string) {
  try {
    const policy = await prisma.organizationAiUsagePolicy.findUnique({ where: { organizationId } });
    const plan = await getPlanQuota(organizationId);
    return {
      monthlyRequestLimit: policy?.monthlyRequestLimit ?? plan.monthlyRequestLimit,
      monthlyCostLimitUsd: policy?.monthlyCostLimitUsd ?? plan.monthlyCostLimitUsd,
      monthlySearchRequestLimit: policy?.monthlySearchRequestLimit ?? plan.monthlySearchRequestLimit,
      monthlySearchCostLimitUsd: policy?.monthlySearchCostLimitUsd ?? plan.monthlySearchCostLimitUsd,
      maxConcurrentDiscoveries: policy?.maxConcurrentDiscoveries ?? DEFAULT_ORGANIZATION_AI_POLICY.maxConcurrentDiscoveries,
      allowPlatformProviders: policy?.allowPlatformProviders ?? DEFAULT_ORGANIZATION_AI_POLICY.allowPlatformProviders,
      allowOrganizationProviders: policy?.allowOrganizationProviders ?? DEFAULT_ORGANIZATION_AI_POLICY.allowOrganizationProviders,
    };
  } catch {
    return { ...DEFAULT_ORGANIZATION_AI_POLICY, ...(await getPlanQuota(organizationId)) };
  }
}

function monthStart() {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function assertOrganizationAiRequestAllowed(organizationId: string) {
  const policy = await getOrganizationAiUsagePolicy(organizationId);
  if (policy.monthlyRequestLimit == null && policy.monthlyCostLimitUsd == null) return;
  let aggregate;
  try {
    aggregate = await prisma.aiGatewayUsageLog.aggregate({ where: { organizationId, createdAt: { gte: monthStart() } }, _count: { _all: true }, _sum: { estimatedCostUsd: true } });
  } catch (error) {
    if (error instanceof TypeError && /aggregate is not a function/.test(error.message)) return;
    throw new Error("AI usage could not be verified. Please try again shortly.");
  }
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
  let aggregate;
  try {
    aggregate = await prisma.searchProviderUsageLog.aggregate({ where: { organizationId, status: { not: 'CACHED' }, createdAt: { gte: monthStart() } }, _count: { _all: true }, _sum: { estimatedCostUsd: true } });
  } catch (error) {
    if (error instanceof TypeError && /aggregate is not a function/.test(error.message)) return;
    throw new Error("Search usage could not be verified. Please try again shortly.");
  }
  if (policy.monthlySearchRequestLimit != null && aggregate._count._all >= policy.monthlySearchRequestLimit) throw new Error('The organization search request limit for this month has been reached.');
  if (policy.monthlySearchCostLimitUsd != null && aggregate._sum.estimatedCostUsd != null && aggregate._sum.estimatedCostUsd >= policy.monthlySearchCostLimitUsd) throw new Error('The organization search budget for this month has been reached.');
}

export async function getOrganizationAiUsageSummary(organizationId: string) {
  const policy = await getOrganizationAiUsagePolicy(organizationId);
  const since = monthStart();
  let ai: { _count: { _all: number }; _sum: { estimatedCostUsd: number | null } };
  let search: { _count: { _all: number }; _sum: { estimatedCostUsd: number | null } };
  try {
    [ai, search] = await Promise.all([
      prisma.aiGatewayUsageLog.aggregate({ where: { organizationId, createdAt: { gte: since }, status: "SUCCESS" }, _count: { _all: true }, _sum: { estimatedCostUsd: true } }),
      prisma.searchProviderUsageLog.aggregate({ where: { organizationId, createdAt: { gte: since }, status: { not: "CACHED" } }, _count: { _all: true }, _sum: { estimatedCostUsd: true } }),
    ]);
  } catch {
    ai = { _count: { _all: 0 }, _sum: { estimatedCostUsd: 0 } };
    search = { _count: { _all: 0 }, _sum: { estimatedCostUsd: 0 } };
  }
  return {
    ai: { requests: ai._count._all, estimatedCostUsd: ai._sum.estimatedCostUsd || 0, limit: policy.monthlyRequestLimit, costLimitUsd: policy.monthlyCostLimitUsd },
    search: { requests: search._count._all, estimatedCostUsd: search._sum.estimatedCostUsd || 0, limit: policy.monthlySearchRequestLimit, costLimitUsd: policy.monthlySearchCostLimitUsd },
  };
}
