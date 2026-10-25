import { describe, expect, it } from 'vitest';
import { READ_ONLY_GRACE_MS } from '@/lib/platform/entitlements';
import { evaluateWorkflowEntitlement } from '@/server/services/workflowEntitlement';

const now = new Date('2026-10-20T12:00:00.000Z');
const startsAt = new Date('2026-10-01T00:00:00.000Z');
const workflowPlan = { features: JSON.stringify(['crm', 'workflows']), isActive: true };

describe('workflow execution entitlement', () => {
  it('allows a writable current subscription with the workflows feature', () => {
    expect(evaluateWorkflowEntitlement({ status: 'ACTIVE', startsAt, endsAt: null, plan: workflowPlan }, now)).toMatchObject({ allowed: true, reasonCode: 'ENTITLEMENT_VALID', access: { readOnly: false, state: 'PAID_ACTIVE' } });
  });

  it('rejects read-only grace and expired subscriptions without changing the 72-hour boundary', () => {
    const endedAt = new Date(now.getTime() - 1);
    expect(evaluateWorkflowEntitlement({ status: 'ACTIVE', startsAt, endsAt: endedAt, plan: workflowPlan }, now)).toMatchObject({ allowed: false, reasonCode: 'WORKSPACE_READ_ONLY', access: { state: 'PAID_READ_ONLY_GRACE', readOnly: true } });
    expect(evaluateWorkflowEntitlement({ status: 'ACTIVE', startsAt, endsAt: new Date(now.getTime() - READ_ONLY_GRACE_MS), plan: workflowPlan }, now)).toMatchObject({ allowed: false, access: { state: 'PAID_EXPIRED', readOnly: true } });
  });

  it('fails closed for missing, inactive, malformed, or feature-less entitlement', () => {
    expect(evaluateWorkflowEntitlement(null, now)).toMatchObject({ allowed: false, reasonCode: 'WORKSPACE_READ_ONLY' });
    expect(evaluateWorkflowEntitlement({ status: 'ACTIVE', startsAt, endsAt: null, plan: { ...workflowPlan, isActive: false } }, now)).toMatchObject({ allowed: false, reasonCode: 'WORKSPACE_READ_ONLY' });
    expect(evaluateWorkflowEntitlement({ status: 'ACTIVE', startsAt, endsAt: null, plan: { features: 'not-json', isActive: true } }, now)).toMatchObject({ allowed: false, reasonCode: 'WORKFLOWS_NOT_INCLUDED' });
    expect(evaluateWorkflowEntitlement({ status: 'ACTIVE', startsAt, endsAt: null, plan: { features: JSON.stringify(['crm']), isActive: true } }, now)).toMatchObject({ allowed: false, reasonCode: 'WORKFLOWS_NOT_INCLUDED' });
  });
});
