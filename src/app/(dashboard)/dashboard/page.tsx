import { getCurrentUser } from '@/lib/auth/session';
import { AnalyticsService } from '@/server/services/AnalyticsService';
import { redirect } from 'next/navigation';
import { DashboardClientView } from '@/components/dashboard/DashboardClientView';
import prisma from '@/lib/db/prisma';
import { CrmWorkspaceService } from '@/server/services/CrmWorkspaceService';
import { CrmDashboardSummary } from '@/components/crm/CrmDashboardSummary';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { OnboardingService } from '@/server/services/OnboardingService';
import { WorkspaceWelcome } from '@/components/onboarding/WorkspaceWelcome';
import { hasPlanFeature, navigationModulesForFeatures } from '@/lib/platform/entitlements';
import { isPlatformAdmin } from '@/lib/security/platform';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (isPlatformAdmin(user)) redirect('/admin');
  if (user.workspaceAccessState === 'TRIAL_EXPIRED') redirect('/trial-expired');
  const setup = await OnboardingService.get(user);
  if (setup.state?.status === 'COMPLETE') {
    const owner = setup.state.ownerId === user.id && hasPermission(user, PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE);
    const state = owner && !setup.state.enteredAt ? await OnboardingService.entered(user).catch(() => setup.state!) : setup.state;
    const viewPermissions: Record<string, string> = { clients: PERMISSIONS.SCHOOLS_VIEW, leads: PERMISSIONS.SCHOOLS_VIEW, contacts: PERMISSIONS.SCHOOLS_VIEW, deals: PERMISSIONS.DEALS_VIEW, pipelines: PERMISSIONS.PIPELINES_VIEW, tasks: PERMISSIONS.TASKS_VIEW };
    const configuredModules = user.planFeatures == null ? setup.modules : navigationModulesForFeatures(user.planFeatures);
    const visibleModules = configuredModules.filter(module => !viewPermissions[module] || hasPermission(user, viewPermissions[module]));
    const crm = await CrmWorkspaceService.dashboard(user, visibleModules);
    return <>{owner && <WorkspaceWelcome state={state} modules={configuredModules} canCreate={hasPlanFeature(user, 'clients') && hasPermission(user, PERMISSIONS.SCHOOLS_CREATE)} canInvite={hasPermission(user, PERMISSIONS.USERS_CREATE)} canConfigure={owner} canPipeline={hasPermission(user, PERMISSIONS.PIPELINES_MANAGE)} canTask={hasPermission(user, PERMISSIONS.TASKS_CREATE)} />}<CrmDashboardSummary data={crm} modules={visibleModules} /></>;
  }

  const [data, schools, taskTypes, users, manager, crm] = await Promise.all([
    AnalyticsService.getDashboardMetrics(user),
    hasPlanFeature(user, 'import_export') ? prisma.school.findMany({ where: { isDeleted: false, organizationId: user.organizationId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
    hasPlanFeature(user, 'tickets') ? prisma.taskType.findMany({ where: { isActive: true, organizationId: user.organizationId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
    hasPlanFeature(user, 'tickets') ? prisma.user.findMany({ where: { isActive: true, organizationMemberships: { some: { organizationId: user.organizationId, status: 'ACTIVE' } }, OR: [{ role: { rolePermissions: { some: { permission: { code: { in: ['tickets.view_assigned', 'tickets.view_all'] } } } } } }, { userPermissions: { some: { permission: { code: { in: ['tickets.view_assigned', 'tickets.view_all'] } } } } }] }, select: { id: true, name: true, email: true, department: { select: { name: true } } }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
    user.reportsToUserId ? prisma.user.findFirst({ where: { id: user.reportsToUserId, organizationMemberships: { some: { organizationId: user.organizationId, status: 'ACTIVE' } } }, select: { id: true, name: true, isActive: true } }) : Promise.resolve(null),
    hasPermission(user, PERMISSIONS.DEALS_VIEW) || hasPermission(user, PERMISSIONS.TASKS_VIEW) || hasPermission(user, PERMISSIONS.SCHOOLS_VIEW) ? CrmWorkspaceService.dashboard(user, user.planFeatures == null ? undefined : navigationModulesForFeatures(user.planFeatures)) : Promise.resolve({ counts: { clients: 0, leads: 0, deals: 0, pipelineValue: '0', openTasks: 0, overdueTasks: 0 }, recentActivity: [], upcomingTasks: [], pipelineSummary: [] }),
  ]);

  return <><CrmDashboardSummary data={crm} /><DashboardClientView user={user} data={data} schools={schools} taskTypes={taskTypes} users={users} directManager={manager ?? null} /></>;
}
