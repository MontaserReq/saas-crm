import { resolveSubscriptionAccess, type SubscriptionAccess } from '@/lib/platform/entitlements';

export type WorkflowEntitlement = {
  allowed: boolean;
  access: SubscriptionAccess;
  reasonCode: 'ENTITLEMENT_VALID' | 'WORKSPACE_READ_ONLY' | 'WORKFLOWS_NOT_INCLUDED';
};

type Subscription = Parameters<typeof resolveSubscriptionAccess>[0];

/**
 * Workflow execution is a server-side mutation and therefore requires both a
 * writable subscription window and the workflows feature. Missing or invalid
 * commercial state is deliberately denied by resolveSubscriptionAccess.
 */
export function evaluateWorkflowEntitlement(subscription: Subscription, now: Date): WorkflowEntitlement {
  const access = resolveSubscriptionAccess(subscription, now);
  if (access.readOnly) return { allowed: false, access, reasonCode: 'WORKSPACE_READ_ONLY' };
  if (!access.features.includes('workflows')) return { allowed: false, access, reasonCode: 'WORKFLOWS_NOT_INCLUDED' };
  return { allowed: true, access, reasonCode: 'ENTITLEMENT_VALID' };
}
