import { setupModuleIds } from '@/lib/onboarding/templates';

export const planFeatureIds = [
  'dashboard', 'clients', 'contacts', 'leads', 'deals', 'pipelines', 'tasks', 'calendar', 'tickets',
  'proposals', 'activities', 'reports', 'team', 'audit_logs', 'messages', 'chat', 'todos', 'ai_assistant',
  'ai_research', 'workflows', 'integrations', 'custom_fields', 'import_export', 'search',
  'email_customer_send', 'documents',
] as const;
export type PlanFeatureId = typeof planFeatureIds[number];

// Product capabilities that are intentionally visible in the product but are
// not released yet. AI Research is no longer static here; Platform Admin
// controls its OFF/BETA/ON state through persisted platform settings.
export const comingSoonFeatureIds = [] as const;
export type ComingSoonFeatureId = typeof comingSoonFeatureIds[number];

export function isFeatureComingSoon(feature: string): feature is ComingSoonFeatureId {
  return (comingSoonFeatureIds as readonly string[]).includes(feature);
}

export function isComingSoonPermissionCode(permissionCode: string): boolean {
  return permissionCode.startsWith('ai_research.');
}

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
  email_customer_send: { en: 'Send customer emails', ar: 'إرسال رسائل البريد للعملاء' },
  documents: { en: 'CRM documents', ar: 'مستندات CRM' },
};

const bundles: Record<string, PlanFeatureId[]> = {
  crm: ['dashboard', 'clients', 'contacts', 'leads', 'deals', 'pipelines', 'proposals', 'documents', 'messages', 'chat'],
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

/** Human-readable labels for the commercial tokens used in the plan editor. */
export const planFeatureTokenLabels: Record<string, { en: string; ar: string }> = {
  ...planFeatureLabels,
  crm: { en: 'Core CRM bundle', ar: 'حزمة CRM الأساسية' },
  tasks: { en: 'Tasks, calendar & tickets', ar: 'المهام والتقويم والتذاكر' },
  permissions: { en: 'Basic roles & permissions', ar: 'الأدوار والصلاحيات الأساسية' },
  'permissions-advanced': { en: 'Advanced roles & permissions', ar: 'الأدوار والصلاحيات المتقدمة' },
  'custom-fields': { en: 'Basic custom fields', ar: 'الحقول المخصصة الأساسية' },
  'custom-fields-expanded': { en: 'Expanded custom fields', ar: 'الحقول المخصصة الموسعة' },
  'import-export': { en: 'Basic import & export', ar: 'الاستيراد والتصدير الأساسي' },
  'import-mappings': { en: 'Mapped import', ar: 'الاستيراد مع مطابقة الأعمدة' },
  'import-advanced': { en: 'Advanced import', ar: 'الاستيراد المتقدم' },
  search: { en: 'Global search', ar: 'البحث الشامل' },
  reports: { en: 'Standard reports', ar: 'التقارير الأساسية' },
  analytics: { en: 'Analytics', ar: 'التحليلات' },
  'analytics-advanced': { en: 'Advanced analytics', ar: 'التحليلات المتقدمة' },
  workflows: { en: 'Standard workflow automation', ar: 'أتمتة سير العمل الأساسية' },
  'workflows-advanced': { en: 'Advanced workflow automation', ar: 'أتمتة سير العمل المتقدمة' },
  integrations: { en: 'External integrations', ar: 'التكاملات الخارجية' },
  'audit-expanded': { en: 'Audit history', ar: 'سجل التدقيق' },
  'audit-governance': { en: 'Governance controls', ar: 'ضوابط الحوكمة' },
  'ai-limited': { en: 'AI assistant', ar: 'المساعد الذكي' },
  'ai-expanded': { en: 'Smart research & AI assistant', ar: 'البحث الذكي والمساعد الذكي' },
  'priority-support-proposed': { en: 'Priority support', ar: 'دعم ذو أولوية' },
  'assisted-onboarding': { en: 'Assisted onboarding', ar: 'إعداد بمرافقة فريقنا' },
  'custom-integrations': { en: 'Custom integrations', ar: 'تكاملات مخصصة' },
};

/** Commercial guardrail: Smart Research is Growth+ and never belongs to Starter. */
export function sanitizePlanFeatureTokensForPlan(planSlug: string | null | undefined, raw: string[]): string[] {
  return planSlug === 'starter' ? raw.filter(token => token !== 'ai-expanded' && token !== 'ai_research') : raw;
}

export function expandPlanFeaturesForPlan(planSlug: string | null | undefined, raw: string | string[] | null | undefined): PlanFeatureId[] {
  const expanded = expandPlanFeatures(raw);
  return planSlug === 'starter' ? expanded.filter(feature => feature !== 'ai_research') : expanded;
}

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
// Public signup keeps the existing seven-day default. Platform administrators
// can grant a different duration to an individual company through the trial
// activation workflow; access resolution always uses the persisted end date.
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
  plan: { slug?: string | null; features: string | string[] | null; isActive: boolean };
} | null | undefined, now = new Date()): SubscriptionAccess {
  if (!subscription?.plan.isActive || subscription.startsAt > now) return { state: 'UNASSIGNED', features: ['dashboard'], readOnly: true, startsAt: subscription?.startsAt ?? null, endsAt: subscription?.endsAt ?? null };
  const features = expandPlanFeaturesForPlan(subscription.plan.slug, subscription.plan.features);
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
  ['documents.', 'documents'],
  ['messages.', 'messages'], ['chat.', 'chat'], ['todo.', 'todos'], ['ai_research.', 'ai_research'], ['ai_assistant.', 'ai_assistant'],
  ['workflows.', 'workflows'], ['custom_fields.', 'custom_fields'], ['search.', 'search'],
  ['customer_email.', 'email_customer_send'],
  ['integrations.', 'integrations'],
  ['email_integrations.', 'integrations'],
  ['attachments.', 'tickets'], ['communications.', 'tickets'],
];
const baselinePermissionPrefixes = ['organization_settings.', 'notifications.', 'notification_preferences.'];

/**
 * Permission records are shared by a few legacy storage names. The tenant
 * UI still exposes those records as customers, contacts and leads, while the
 * school-only activity/analytics records and the not-yet-released assistant
 * stay out of the company RBAC matrix.
 */
export function isCompanyAssignablePermissionCode(permissionCode: string): boolean {
  return !permissionCode.startsWith('ai_assistant.')
    && permissionCode !== 'activity.view_school'
    && permissionCode !== 'analytics.view_schools';
}

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
  ['/admin/approval-requests', 'team'], ['/admin/analytics', 'reports'], ['/admin/team-activity', 'reports'], ['/admin/audit-logs', 'audit_logs'], ['/admin/users', 'team'], ['/admin/roles', 'team'], ['/admin/departments', 'team'], ['/admin/task-types', 'team'],
  ['/ai-school-research', 'ai_research'], ['/lead-discovery', 'ai_research'], ['/assignments', 'import_export'], ['/schools', 'import_export'], ['/imports', 'import_export'], ['/clients', 'clients'], ['/contacts', 'contacts'], ['/leads', 'leads'], ['/deals', 'deals'], ['/pipelines', 'pipelines'], ['/tasks', 'tasks'], ['/calendar', 'calendar'], ['/tickets', 'tickets'], ['/proposals', 'proposals'], ['/documents', 'documents'], ['/activity', 'activities'], ['/messages', 'messages'], ['/chat', 'chat'], ['/todos', 'todos'],
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
  // A Company Super Admin can administer the tenant, but paid Smart Research
  // remains Growth+ and the AI assistant remains unreleased.
  if ('role' in user && user.role === 'SUPER_ADMIN') {
    if (feature === 'ai_assistant') return false;
    if (feature === 'ai_research') return (user.planFeatures ?? ['dashboard']).includes('ai_research');
    return true;
  }
  return (user.planFeatures ?? ['dashboard']).includes(feature);
}

export function planFeatureDisplay(raw: string | string[] | null | undefined) {
  return expandPlanFeatures(raw).filter(feature => feature !== 'dashboard');
}
