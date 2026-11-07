import prisma from '@/lib/db/prisma';
import { hasPlanFeature, expandPlanFeatures } from '@/lib/platform/entitlements';
import type { UserSession } from '@/types';
import { managedIntegrationCatalog, managedIntegrationProviders, type ManagedIntegrationProvider } from '@/lib/integrations/catalog';
import { isPlatformSuperAdmin } from '@/lib/security/platform';

export const INTEGRATION_POLICY_DISABLED = 'INTEGRATION_POLICY_DISABLED';

export class IntegrationEntitlementService {
  static async isEnabledForOrganization(organizationId: string, provider: ManagedIntegrationProvider) {
    const subscription = await prisma.platformSubscription.findUnique({
      where: { organizationId },
      select: { planId: true, plan: { select: { features: true, isActive: true } } },
    });
    if (!subscription?.plan.isActive) return false;
    if (!expandPlanFeatures(subscription.plan.features).includes('integrations')) return false;
    const policy = await prisma.platformPlanIntegration.findUnique({
      where: { planId_provider: { planId: subscription.planId, provider } },
      select: { enabled: true },
    });
    return policy?.enabled !== false;
  }

  static async isEnabledForUser(user: UserSession, provider: ManagedIntegrationProvider) {
    if (!user.organizationId || !hasPlanFeature(user, 'integrations')) return false;
    if (isPlatformSuperAdmin(user)) return true;
    return this.isEnabledForOrganization(user.organizationId, provider);
  }

  static async requireEnabledForUser(user: UserSession, provider: ManagedIntegrationProvider) {
    if (!(await this.isEnabledForUser(user, provider))) throw new Error(INTEGRATION_POLICY_DISABLED);
  }

  static async listPolicies(user: UserSession) {
    if (!isPlatformSuperAdmin(user)) throw new Error('Forbidden');
    const plans = await prisma.platformPlan.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, isActive: true, features: true, integrationEntitlements: { select: { provider: true, enabled: true } } },
    });
    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      isActive: plan.isActive,
      included: expandPlanFeatures(plan.features).includes('integrations'),
      integrations: managedIntegrationProviders.map((provider) => ({
        provider,
        enabled: plan.integrationEntitlements.find((item) => item.provider === provider)?.enabled !== false,
      })),
    }));
  }

  static catalog() { return managedIntegrationCatalog; }
}
