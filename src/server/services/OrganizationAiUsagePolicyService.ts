import prisma from '@/lib/db/prisma';
import type { UserSession } from '@/types';
import { requireOrganizationContext } from '@/lib/auth/organization';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { organizationAiUsagePolicyInput } from '@/lib/platform/validation';
import { AuditService } from './AuditService';
import { getOrganizationAiUsagePolicy } from '@/lib/ai/organizationPolicy';

export class OrganizationAiUsagePolicyService {
  static async get(user: UserSession) {
    if (!hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_VIEW)) throw new Error('Forbidden');
    return getOrganizationAiUsagePolicy((await requireOrganizationContext(user)).id);
  }

  static async save(user: UserSession, raw: unknown) {
    if (!hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)) throw new Error('Forbidden');
    const organizationId = (await requireOrganizationContext(user)).id;
    const input = organizationAiUsagePolicyInput.parse(raw);
    const policy = await prisma.organizationAiUsagePolicy.upsert({ where: { organizationId }, create: { organizationId, ...input }, update: input });
    await AuditService.logAudit({ actorId: user.id, organizationId, action: 'ORGANIZATION_AI_USAGE_POLICY_UPDATED', entityType: 'OrganizationAiUsagePolicy', entityId: policy.id, metadata: { monthlyRequestLimit: input.monthlyRequestLimit, monthlyCostLimitUsd: input.monthlyCostLimitUsd, monthlySearchRequestLimit: input.monthlySearchRequestLimit, monthlySearchCostLimitUsd: input.monthlySearchCostLimitUsd, maxConcurrentDiscoveries: input.maxConcurrentDiscoveries, allowPlatformProviders: input.allowPlatformProviders, allowOrganizationProviders: input.allowOrganizationProviders } });
    return getOrganizationAiUsagePolicy(organizationId);
  }
}
