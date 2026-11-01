import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { SettingsClientView } from '@/components/settings/SettingsClientView';
import { OrganizationConfigService } from '@/server/services/OrganizationConfigService';
import { CustomFieldService } from '@/server/services/CustomFieldService';
import { WorkspaceModules } from '@/components/onboarding/WorkspaceModules';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { hasPlanFeature } from '@/lib/platform/entitlements';
import prisma from '@/lib/db/prisma';
import { EmailIntegrationSettings } from '@/components/settings/EmailIntegrationSettings';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const customFieldEntityFeatures = { CLIENT: 'clients', LEAD: 'leads', CONTACT: 'contacts', DEAL: 'deals', TICKET: 'tickets', TASK: 'tasks' } as const;
  const customFieldEntities = Object.entries(customFieldEntityFeatures).filter(([, feature]) => hasPlanFeature(user, feature)).map(([entity]) => entity);
  const canUseCustomFields = hasPlanFeature(user, 'custom_fields') && customFieldEntities.length > 0;
  const [config, unfilteredFields, integrations] = await Promise.all([
    OrganizationConfigService.get(user),
    canUseCustomFields ? CustomFieldService.listDefinitions(user) : Promise.resolve([]),
    user.organizationId ? prisma.externalIntegration.findMany({ where: { organizationId: user.organizationId }, select: { provider: true, accountEmail: true, scopes: true, tokenExpiresAt: true } }) : Promise.resolve([]),
  ]);
  const fields = unfilteredFields.filter(field => customFieldEntities.includes(field.entityType));
  return <div className="space-y-6">
    <SettingsClientView config={config} fields={fields} customFieldEntities={customFieldEntities} canUseCustomFields={canUseCustomFields} canConfigureClients={hasPlanFeature(user, 'clients')} canConfigureLeads={hasPlanFeature(user, 'leads')} canManageApprovals={hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)} />
    {config.settings.onboardingState && user.planFeatures == null && hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE) && <WorkspaceModules initialModules={config.settings.enabledModules} />}
    {user.planFeatures?.includes('integrations') && <EmailIntegrationSettings integrations={integrations.map((item) => { let scopes: string[] = []; try { scopes = JSON.parse(item.scopes || '[]'); } catch { scopes = []; } return { ...item, provider: item.provider.toLowerCase(), scopes, tokenExpiresAt: item.tokenExpiresAt?.toISOString() || null }; })} canManage={hasPermission(user, PERMISSIONS.EMAIL_INTEGRATIONS_MANAGE) || hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)} googleApprovalPending={process.env.GOOGLE_EMAIL_INTEGRATION_PENDING_REVIEW === 'true'} />}
  </div>;
}
