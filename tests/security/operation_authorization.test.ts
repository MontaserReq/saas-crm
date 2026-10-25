import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateCurrentOperationAuthorization } from '@/lib/security/operationAuthorization';

const now = new Date('2026-10-20T12:00:00.000Z');
const subscription = {
  status: 'ACTIVE',
  startsAt: new Date('2026-10-01T00:00:00.000Z'),
  endsAt: null,
  trialEndsAt: null,
  plan: { isActive: true, features: JSON.stringify(['ai_research', 'workflows']) },
};

function transaction() {
  const tx: any = {
    $queryRaw: vi.fn()
      .mockResolvedValueOnce([{ id: 'org-a' }])
      .mockResolvedValueOnce([{ now }]),
    platformSubscription: { findUnique: vi.fn().mockResolvedValue(subscription) },
    organizationMember: {
      findFirst: vi.fn().mockResolvedValue({
        role: { name: 'ADMIN', rolePermissions: [{ permission: { code: 'ai_research.create' } }, { permission: { code: 'ai_research.run' } }] },
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        isActive: true,
        isPlatformAdmin: false,
        role: { name: 'ADMIN', rolePermissions: [] },
        userPermissions: [],
      }),
    },
  };
  return tx;
}

describe('authoritative background-operation authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows an active member with current feature and permissions', async () => {
    const result = await evaluateCurrentOperationAuthorization(transaction(), {
      organizationId: 'org-a', userId: 'user-a', feature: 'ai_research',
      requiredPermissions: ['ai_research.create', 'ai_research.run'],
    });
    expect(result).toMatchObject({ allowed: true, reasonCode: 'AUTHORIZED', access: { readOnly: false } });
  });

  it('fails closed when a permission is revoked after a job starts', async () => {
    const tx = transaction();
    tx.organizationMember.findFirst.mockResolvedValue({ role: { name: 'ADMIN', rolePermissions: [{ permission: { code: 'ai_research.create' } }] } });
    const result = await evaluateCurrentOperationAuthorization(tx, {
      organizationId: 'org-a', userId: 'user-a', feature: 'ai_research',
      requiredPermissions: ['ai_research.create', 'ai_research.run'],
    });
    expect(result).toMatchObject({ allowed: false, reasonCode: 'PERMISSION_REVOKED' });
  });

  it('fails closed when membership or account authority is revoked', async () => {
    const removed = transaction();
    removed.organizationMember.findFirst.mockResolvedValue(null);
    expect(await evaluateCurrentOperationAuthorization(removed, {
      organizationId: 'org-a', userId: 'user-a', feature: 'workflows', requiredPermissions: ['workflows.execute'],
    })).toMatchObject({ allowed: false, reasonCode: 'MEMBERSHIP_INACTIVE' });

    const disabled = transaction();
    disabled.user.findUnique.mockResolvedValue(null);
    expect(await evaluateCurrentOperationAuthorization(disabled, {
      organizationId: 'org-a', userId: 'user-a', feature: 'workflows', requiredPermissions: ['workflows.execute'],
    })).toMatchObject({ allowed: false, reasonCode: 'ACTOR_INACTIVE' });
  });

  it('fails closed when the subscription becomes read-only or loses the feature', async () => {
    const expired = transaction();
    expired.platformSubscription.findUnique.mockResolvedValue({ ...subscription, status: 'EXPIRED', endsAt: new Date('2026-10-01T00:00:00.000Z') });
    expect(await evaluateCurrentOperationAuthorization(expired, {
      organizationId: 'org-a', userId: 'user-a', feature: 'ai_research', requiredPermissions: [],
    })).toMatchObject({ allowed: false, reasonCode: 'WORKSPACE_READ_ONLY' });

    const missingFeature = transaction();
    missingFeature.platformSubscription.findUnique.mockResolvedValue({ ...subscription, plan: { isActive: true, features: '[]' } });
    expect(await evaluateCurrentOperationAuthorization(missingFeature, {
      organizationId: 'org-a', userId: 'user-a', feature: 'ai_research', requiredPermissions: [],
    })).toMatchObject({ allowed: false, reasonCode: 'FEATURE_NOT_INCLUDED' });
  });
});
