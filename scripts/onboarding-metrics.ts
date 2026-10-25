// Read-only aggregate report using the existing audit stream; no customer data.
// Run: npx tsx scripts/onboarding-metrics.ts (optional ONBOARDING_METRICS_DAYS).
import prisma from '../src/lib/db/prisma';

const actions = ['SIGNUP_STARTED', 'SIGNUP_COMPLETED', 'ONBOARDING_STARTED', 'ONBOARDING_BUSINESS_SELECTED', 'ONBOARDING_CONFIGURATION_GENERATED', 'ONBOARDING_STEP_COMPLETED', 'ONBOARDING_STEP_SKIPPED', 'ONBOARDING_RESUMED', 'ONBOARDING_ABANDONED', 'WORKSPACE_PROVISIONED', 'WORKSPACE_PROVISIONING_FAILED', 'ONBOARDING_COMPLETED', 'ONBOARDING_CRM_ENTERED', 'ONBOARDING_FIRST_USEFUL_ACTION'];
function percentile(values: number[], proportion: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * proportion) - 1)];
}
async function main() {
  const days = Number(process.env.ONBOARDING_METRICS_DAYS || 30);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('Use 1–365 days');
  const from = new Date(Date.now() - days * 86400000);
  const events = await prisma.auditLog.findMany({ where: { action: { in: actions }, createdAt: { gte: from } }, select: { action: true, organizationId: true, entityId: true, metadata: true } });
  const metadata = (raw: string | null): Record<string, unknown> => { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } };
  const unique = (action: string) => new Set(events.filter(event => event.action === action && event.organizationId).map(event => event.organizationId!));
  const attempts = new Set(events.filter(event => event.action === 'SIGNUP_STARTED').map(event => event.entityId));
  const convertedAttempts = new Set(events.filter(event => event.action === 'SIGNUP_COMPLETED').map(event => metadata(event.metadata).attemptId).filter(id => typeof id === 'string' && attempts.has(id)));
  const started = unique('ONBOARDING_STARTED'); const provisioned = unique('WORKSPACE_PROVISIONED');
  const completedCohort = [...provisioned].filter(id => started.has(id));
  const elapsed = (action: string, key: string) => events.filter(event => event.action === action).map(event => metadata(event.metadata)[key]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  const durations = (values: number[]) => ({ samples: values.length, medianMs: percentile(values, 0.5), p90Ms: percentile(values, 0.9) });
  const stage = (step: number) => new Set(events.filter(event => ['ONBOARDING_STEP_COMPLETED', 'ONBOARDING_STEP_SKIPPED'].includes(event.action) && metadata(event.metadata).step === step).map(event => event.organizationId)).size;
  const failureEvents = events.filter(event => event.action === 'WORKSPACE_PROVISIONING_FAILED').length;
  const successfulEvents = events.filter(event => event.action === 'WORKSPACE_PROVISIONED').length;
  const pending = await prisma.organizationSettings.findMany({ where: { onboardingState: { not: null } }, select: { onboardingState: true, updatedAt: true } });
  const drafts = pending.filter(settings => metadata(settings.onboardingState).status === 'PENDING');
  console.log(JSON.stringify({
    from: from.toISOString(), to: new Date().toISOString(), signupStarts: attempts.size, signupCompletions: convertedAttempts.size,
    signupCompletionRate: attempts.size ? convertedAttempts.size / attempts.size : null,
    onboardingStarts: started.size, workspacesCompleted: completedCohort.length,
    onboardingCompletionRate: started.size ? completedCohort.length / started.size : null,
    // Completion is the fourth stage; older three-stage completions remain
    // measurable using WORKSPACE_PROVISIONED rather than a made-up fourth event.
    completedSteps: [1, 2, 3, 4].map(step => ({ step, organizations: stage(step) })),
    configurationsGenerated: unique('ONBOARDING_CONFIGURATION_GENERATED').size,
    enteredCrm: unique('ONBOARDING_CRM_ENTERED').size,
    configurationChoices: { customized: events.filter(event => event.action === 'WORKSPACE_PROVISIONED' && metadata(event.metadata).customized === true).length, recommended: events.filter(event => event.action === 'WORKSPACE_PROVISIONED' && metadata(event.metadata).customized === false && metadata(event.metadata).standard !== true).length, standard: events.filter(event => event.action === 'WORKSPACE_PROVISIONED' && metadata(event.metadata).standard === true).length },
    optionalStepSkipped: unique('ONBOARDING_STEP_SKIPPED').size,
    explicitAbandonEvents: events.filter(event => event.action === 'ONBOARDING_ABANDONED').length,
    resumedOrganizations: unique('ONBOARDING_RESUMED').size,
    pendingWorkspaces: drafts.length, inactiveDrafts24h: drafts.filter(settings => settings.updatedAt.getTime() < Date.now() - 86400000).length,
    provisioningFailures: failureEvents,
    provisioningFailureRate: failureEvents + successfulEvents ? failureEvents / (failureEvents + successfulEvents) : null,
    signupToUsableWorkspace: durations(elapsed('WORKSPACE_PROVISIONED', 'signupToWorkspaceMs')),
    signupToFirstUsefulAction: durations(elapsed('ONBOARDING_FIRST_USEFUL_ACTION', 'signupToActionMs')),
    workspaceToFirstUsefulAction: durations(elapsed('ONBOARDING_FIRST_USEFUL_ACTION', 'workspaceToActionMs')),
  }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Metrics unavailable'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
