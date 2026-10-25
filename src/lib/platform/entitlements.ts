import { setupModuleIds } from '@/lib/onboarding/templates';

export const planFeatureIds = [
  'dashboard', 'clients', 'contacts', 'leads', 'deals', 'pipelines', 'tasks', 'calendar', 'tickets',
  'proposals', 'activities', 'reports', 'team', 'audit_logs', 'messages', 'chat', 'todos', 'ai_assistant',
  'ai_research', 'workflows', 'integrations', 'custom_fields', 'import_export', 'search',
] as const;
export type PlanFeatureId = typeof planFeatureIds[number];

export const planFeatureLabels: Record<PlanFeatureId, { en: string; ar: string }> = {
  dashboard: { en: 'Dashboard', ar: 'لوحة التحكم' }, clients: { en: 'Customers & companies', ar: 'العملاء والشركات' },
  contacts: { en: 'Contacts', ar: 'جهات الاتصال' }, leads: { en: 'Leads', ar: 'العملاء المحتملون' },
  deals: { en: 'Deals', ar: 'الصفقات' }, pipelines: { en: 'Sales pipelines', ar: 'مسارات المبيعات' },
  tasks: { en: 'Tasks', ar: 'المهام' }, calendar: { en: 'Calendar', ar: 'التقويم' },
  tickets: { en: 'Customer support tickets', ar: 'تذاكر دعم العملاء' }, proposals: { en: 'Proposals', ar: 'العروض' },
  activities: { en: 'Activity feed', ar: 'سجل النشاط' }, reports: { en: 'Reports & analytics', ar: 'التقارير والتحليلات' },
  team: { en: 'Team, roles & permissions', ar: 'الفريق والأدوار والصلاحيات' }, audit_logs: { en: 'Audit logs', ar: 'سجل التدقيق' },
  messages: { en: 'Messages', ar: 'الرسائل' }, chat: { en: 'Internal messages', ar: 'الرسائل الداخلية' },
  todos: { en: 'Personal to-dos', ar: 'المهام الشخصية' }, ai_assistant: { en: 'AI assistant', ar: 'المساعد الذكي' },
  ai_research: { en: 'AI research', ar: 'البحث الذكي' }, workflows: { en: 'Workflow automation', ar: 'أتمتة سير العمل' },
  integrations: { en: 'External integrations', ar: 'التكاملات الخارجية' }, custom_fields: { en: 'Custom fields', ar: 'الحقول المخصصة' },
  import_export: { en: 'Import, export & assignments', ar: 'الاستيراد والتصدير والتعيينات' }, search: { en: 'Global search', ar: 'البحث الشامل' },
};

const bundles: Record<string, PlanFeatureId[]> = {
  crm: ['dashboard', 'clients', 'contacts', 'leads', 'deals', 'pipelines', 'proposals', 'messages', 'chat'],
  tasks: ['tasks', 'calendar', 'tickets', 'todos'],
  permissions: ['team'], 'permissions-advanced': ['team'],
  'custom-fields': ['custom_fields'], 'custom-fields-expanded': ['custom_fields'],
  'import-export': ['import_export'], 'import-mappings': ['import_export'], 'import-advanced': ['import_export'],
  search: ['search'], reports: ['reports', 'activities'], analytics: ['reports', 'activities'], 'analytics-advanced': ['reports', 'activities'],
  workflows: ['workflows'], 'workflows-advanced': ['workflows'], integrations: ['integrations'],
  'audit-expanded': ['audit_logs', 'activities'], 'audit-governance': ['audit_logs', 'activities'],
  'ai-limited': ['ai_assistant'], 'ai-expanded': ['ai_assistant', 'ai_research'],
};
const nonUiPlanFeatures = ['priority-support-proposed', 'assisted-onboarding', 'custom-integrations'] as const;
export const allowedPlanFeatureTokens = [...planFeatureIds, ...Object.keys(bundles), ...nonUiPlanFeatures];
export function areKnownPlanFeatureTokens(values: readonly string[]) { return values.every(value => allowedPlanFeatureTokens.includes(value)); }

const featureSet = new Set<string>(planFeatureIds);
export const coreWorkspaceFeatures: PlanFeatureId[] = ['todos', 'calendar', 'messages', 'chat'];
export function parsePlanFeatures(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) return raw.filter(value => typeof value === 'string');
  if (!raw) return [];
  try { const value = JSON.parse(raw); return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []; } catch { return []; }
}
function hasValidFeatureList(raw: string | string[] | null | undefined): boolean {
  if (Array.isArray(raw)) return true;
  if (typeof raw !== 'string' || !raw.trim()) return false;
  try { return Array.isArray(JSON.parse(raw)); } catch { return false; }
}
export function expandPlanFeatures(raw: string | string[] | null | undefined): PlanFeatureId[] {
  const expanded = new Set<PlanFeatureId>();
  for (const item of parsePlanFeatures(raw)) {
    if (featureSet.has(item)) expanded.add(item as PlanFeatureId);
    for (const feature of bundles[item] ?? []) expanded.add(feature);
  }
  expanded.add('dashboard');
  if (hasValidFeatureList(raw)) for (const feature of coreWorkspaceFeatures) expanded.add(feature);
  return [...expanded];
}

export type FeatureOverrides = {
  enable: PlanFeatureId[];
  disable: PlanFeatureId[];
};

export function parseFeatureOverrides(raw: string | null | undefined): FeatureOverrides {
  if (!raw) return { enable: [], disable: [] };
  try {
    const parsed = JSON.parse(raw) as { enable?: unknown; disable?: unknown };
    const valid = (value: unknown) =>
      Array.isArray(value)
        ? value.filter((item): item is PlanFeatureId => featureSet.has(String(item)))
        : [];
    return { enable: valid(parsed.enable), disable: valid(parsed.disable) };
  } catch {
    return { enable: [], disable: [] };
  }
}

export function applyFeatureOverrides(
  features: readonly PlanFeatureId[],
  raw: string | null | undefined,
): PlanFeatureId[] {
  const overrides = parseFeatureOverrides(raw);
  const resolved = new Set<PlanFeatureId>(features);
  for (const feature of overrides.disable) resolved.delete(feature);
  for (const feature of overrides.enable) resolved.add(feature);
  resolved.add('dashboard');
  return [...resolved];
}

export function resolveSubscriptionFeatures(subscription: {
  status: string;
  startsAt: Date;
  endsAt: Date | null;
  trialEndsAt?: Date | null;
  plan: { features: string | string[] | null; isActive: boolean };
} | null | undefined, now = new Date()): PlanFeatureId[] {
  return resolveSubscriptionAccess(subscription, now).features;
}

export type WorkspaceAccessState = 'ACTIVE_TRIAL' | 'TRIAL_EXPIRING' | 'TRIAL_READ_ONLY_GRACE' | 'TRIAL_EXPIRED' | 'PAID_ACTIVE' | 'PAID_READ_ONLY_GRACE' | 'PAID_EXPIRED' | 'UNASSIGNED';
export type SubscriptionAccess = {
  state: WorkspaceAccessState;
  features: PlanFeatureId[];
  readOnly: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};
export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const TRIAL_WARNING_MS = 24 * 60 * 60 * 1000;
export const READ_ONLY_GRACE_MS = 72 * 60 * 60 * 1000;

/**
 * Commercial access is derived only from persisted server timestamps. Expired
 * workspaces retain the features needed to read their existing records while
 * the permission layer removes every mutating permission.
 */
export function resolveSubscriptionAccess(subscription: {
  status: string;
  startsAt: Date;
  endsAt: Date | null;
  trialEndsAt?: Date | null;
  plan: { features: string | string[] | null; isActive: boolean };
} | null | undefined, now = new Date()): SubscriptionAccess {
  if (!subscription?.plan.isActive || subscription.startsAt > now) return { state: 'UNASSIGNED', features: ['dashboard'], readOnly: true, startsAt: subscription?.startsAt ?? null, endsAt: subscription?.endsAt ?? null };
  const features = expandPlanFeatures(subscription.plan.features);
  if (subscription.status === 'ACTIVE' || subscription.status === 'CANCELLED') {
    if ((subscription.status === 'ACTIVE' && !subscription.endsAt) || (subscription.endsAt && subscription.endsAt > now)) return { state: 'PAID_ACTIVE', features, readOnly: false, startsAt: subscription.startsAt, endsAt: subscription.endsAt };
    if (subscription.endsAt && subscription.endsAt.getTime() + READ_ONLY_GRACE_MS > now.getTime()) return { state: 'PAID_READ_ONLY_GRACE', features, readOnly: true, startsAt: subscription.startsAt, endsAt: subscription.endsAt };
    return { state: 'PAID_EXPIRED', features, readOnly: true, startsAt: subscription.startsAt, endsAt: subscription.endsAt };
  }
  if (subscription.status === 'TRIAL') {
    if (!subscription.endsAt) return { state: 'TRIAL_EXPIRED', features, readOnly: true, startsAt: subscription.startsAt, endsAt: subscription.endsAt };
    if (subscription.endsAt <= now) {
      if (subscription.endsAt.getTime() + READ_ONLY_GRACE_MS > now.getTime()) return { state: 'TRIAL_READ_ONLY_GRACE', features, readOnly: true, startsAt: subscription.startsAt, endsAt: subscription.endsAt };
      return { state: 'TRIAL_EXPIRED', features, readOnly: true, startsAt: subscription.startsAt, endsAt: subscription.endsAt };
    }
    const state = subscription.endsAt.getTime() - now.getTime() <= TRIAL_WARNING_MS ? 'TRIAL_EXPIRING' : 'ACTIVE_TRIAL';
    return { state, features, readOnly: false, startsAt: subscription.startsAt, endsAt: subscription.endsAt };
  }
  const trialExpired = subscription.status === 'EXPIRED' && subscription.trialEndsAt !== null && subscription.trialEndsAt !== undefined && subscription.endsAt?.getTime() === subscription.trialEndsAt.getTime();
  if (trialExpired && subscription.endsAt && subscription.endsAt.getTime() + READ_ONLY_GRACE_MS > now.getTime()) {
    return { state: 'TRIAL_READ_ONLY_GRACE', features, readOnly: true, startsAt: subscription.startsAt, endsAt: subscription.endsAt };
  }
  if (!trialExpired && subscription.endsAt && subscription.endsAt.getTime() + READ_ONLY_GRACE_MS > now.getTime()) {
    return { state: 'PAID_READ_ONLY_GRACE', features, readOnly: true, startsAt: subscription.startsAt, endsAt: subscription.endsAt };
  }
  return { state: trialExpired ? 'TRIAL_EXPIRED' : 'PAID_EXPIRED', features, readOnly: true, startsAt: subscription.startsAt, endsAt: subscription.endsAt };
}

export function navigationModulesForFeatures(features: readonly string[]): string[] {
  const allowed = new Set(features);
  return setupModuleIds.filter(module => allowed.has(module));
}

const permissionFeature: Array<[string, PlanFeatureId]> = [
  ['users.', 'team'], ['roles.', 'team'], ['departments.', 'team'], ['task_types.', 'team'], ['approval_requests.', 'team'],
  ['deals.', 'deals'], ['pipelines.', 'pipelines'], ['tasks.', 'tasks'], ['tickets.', 'tickets'], ['calendar.', 'calendar'],
  ['proposals.', 'proposals'], ['analytics.', 'reports'], ['reports.', 'reports'], ['audit_logs.', 'audit_logs'], ['activity.', 'activities'],
  ['messages.', 'messages'], ['chat.', 'chat'], ['todo.', 'todos'], ['ai_research.', 'ai_research'], ['ai_assistant.', 'ai_assistant'],
  ['workflows.', 'workflows'], ['custom_fields.', 'custom_fields'], ['search.', 'search'],
  ['attachments.', 'tickets'], ['communications.', 'tickets'],
];
const baselinePermissionPrefixes = ['organization_settings.', 'notifications.'];
export function filterPermissionsForPlan(permissions: readonly string[], features: readonly string[] | null): string[] {
  const allowed = new Set(features ?? ['dashboard']);
  return permissions.filter(permission => {
    if (permission === 'schools.import' || permission === 'schools.export' || permission === 'schools.assign') return allowed.has('import_export');
    if (permission.startsWith('schools.')) return allowed.has('clients') || allowed.has('leads');
    const mapping = permissionFeature.find(([prefix]) => permission.startsWith(prefix));
    if (mapping) return allowed.has(mapping[1]);
    return baselinePermissionPrefixes.some(prefix => permission.startsWith(prefix));
  });
}

const routeFeatures: Array<[string, PlanFeatureId]> = [
  ['/settings/workflows', 'workflows'], ['/settings/message-templates', 'messages'], ['/settings/ticket-priorities', 'tickets'],
  ['/admin/approval-requests', 'team'], ['/admin/analytics', 'reports'], ['/admin/audit-logs', 'audit_logs'], ['/admin/users', 'team'], ['/admin/roles', 'team'], ['/admin/departments', 'team'], ['/admin/task-types', 'team'],
  ['/ai-school-research', 'ai_research'], ['/assignments', 'import_export'], ['/schools', 'import_export'], ['/imports', 'import_export'], ['/clients', 'clients'], ['/contacts', 'contacts'], ['/leads', 'leads'], ['/deals', 'deals'], ['/pipelines', 'pipelines'], ['/tasks', 'tasks'], ['/calendar', 'calendar'], ['/tickets', 'tickets'], ['/proposals', 'proposals'], ['/activity', 'activities'], ['/messages', 'messages'], ['/chat', 'chat'], ['/todos', 'todos'],
];
export function featureForRoute(pathname: string): PlanFeatureId | null {
  return routeFeatures.find(([route]) => pathname === route || pathname.startsWith(`${route}/`))?.[1] ?? null;
}
export function isRouteIncluded(pathname: string, features: readonly string[] | null) {
  if (pathname.startsWith('/admin/platform')) return true;
  const feature = featureForRoute(pathname);
  return !feature || (features ?? ['dashboard']).includes(feature);
}
export function hasPlanFeature(user: { planFeatures?: readonly string[] | null }, feature: PlanFeatureId) {
  return (user.planFeatures ?? ['dashboard']).includes(feature);
}

export function planFeatureDisplay(raw: string | string[] | null | undefined) {
  return expandPlanFeatures(raw).filter(feature => feature !== 'dashboard');
}
