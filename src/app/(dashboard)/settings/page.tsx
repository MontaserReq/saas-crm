import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { SettingsClientView } from '@/components/settings/SettingsClientView';
import { OrganizationConfigService } from '@/server/services/OrganizationConfigService';
import { CustomFieldService } from '@/server/services/CustomFieldService';
import { WorkspaceModules } from '@/components/onboarding/WorkspaceModules';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { hasPlanFeature } from '@/lib/platform/entitlements';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const customFieldEntityFeatures = { CLIENT: 'clients', LEAD: 'leads', CONTACT: 'contacts', DEAL: 'deals', TICKET: 'tickets', TASK: 'tasks' } as const;
  const customFieldEntities = Object.entries(customFieldEntityFeatures).filter(([, feature]) => hasPlanFeature(user, feature)).map(([entity]) => entity);
  const canUseCustomFields = hasPlanFeature(user, 'custom_fields') && customFieldEntities.length > 0;
  const [config, unfilteredFields] = await Promise.all([OrganizationConfigService.get(user), canUseCustomFields ? CustomFieldService.listDefinitions(user) : Promise.resolve([])]);
  const fields = unfilteredFields.filter(field => customFieldEntities.includes(field.entityType));
  return <div className="space-y-6">
    <SettingsClientView config={config} fields={fields} customFieldEntities={customFieldEntities} canUseCustomFields={canUseCustomFields} canConfigureClients={hasPlanFeature(user, 'clients')} canConfigureLeads={hasPlanFeature(user, 'leads')} canManageApprovals={hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE)} />
    {config.settings.onboardingState && user.planFeatures == null && hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE) && <WorkspaceModules initialModules={config.settings.enabledModules} />}
  </div>;
}
