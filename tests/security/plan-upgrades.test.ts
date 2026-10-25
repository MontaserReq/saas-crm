import { describe, expect, it, vi } from 'vitest';
import { assignmentInput, decisionInput, isPlanUpgrade, upgradeInput } from '@/lib/platform/upgrades';
import type { UserSession } from '@/types';

const db = vi.hoisted(() => ({ $transaction: vi.fn(), organization: { findUnique: vi.fn(), count: vi.fn() } }));
vi.mock('@/lib/db/prisma', () => ({ default: db }));
import { PlanUpgradeService } from '@/server/services/PlanUpgradeService';
import { CompanyStatisticsService } from '@/server/services/CompanyStatisticsService';

describe('plan upgrades and company statistics security', () => {
  it('rejects browser-supplied company IDs and authority fields on tenant requests', () => {
    for (const patch of [{ organizationId: 'other-company' }, { requestedById: 'other-user' }, { status: 'APPROVED' }, { reviewedById: 'admin' }]) expect(upgradeInput.safeParse({ planId: 'growth', billingInterval: 'monthly', ...patch }).success).toBe(false);
    expect(decisionInput.safeParse({ id: 'request', decision: 'PENDING' }).success).toBe(false);
    expect(assignmentInput.safeParse({ organizationId: 'company', planId: 'growth', billingInterval: 'weekly' }).success).toBe(false);
  });
  it('allows only higher plans and supports an unassigned company', () => {
    const starter = { id: 'starter', monthlyPrice: 39, userLimit: 3 };
    const growth = { id: 'growth', monthlyPrice: 99, userLimit: 10 };
    const enterprise = { id: 'enterprise', monthlyPrice: null, userLimit: null };
    expect(isPlanUpgrade(starter, growth)).toBe(true);
    expect(isPlanUpgrade(growth, enterprise)).toBe(true);
    expect(isPlanUpgrade(null, starter)).toBe(true);
    expect(isPlanUpgrade(growth, starter)).toBe(false);
    expect(isPlanUpgrade(growth, growth)).toBe(false);
    expect(isPlanUpgrade(enterprise, growth)).toBe(false);
  });
  it.each([{ role: 'ADMIN', isPlatformAdmin: false }, { role: 'SUPER_ADMIN', isPlatformAdmin: true }, { role: 'PLATFORM_ADMIN', isPlatformAdmin: false }, { role: 'ADMIN', isPlatformAdmin: true }])('blocks non-platform authority before database access: %j', async authority => {
    const user = { id: 'tenant-user', ...authority } as UserSession;
    await expect(PlanUpgradeService.assign(user, {})).rejects.toThrow('FORBIDDEN');
    await expect(PlanUpgradeService.decide(user, {})).rejects.toThrow('FORBIDDEN');
    await expect(PlanUpgradeService.requests(user)).rejects.toThrow('FORBIDDEN');
    await expect(CompanyStatisticsService.detail(user, 'another-company')).rejects.toThrow('FORBIDDEN');
    await expect(CompanyStatisticsService.list(user, '', 1)).rejects.toThrow('FORBIDDEN');
    expect(db.$transaction).not.toHaveBeenCalled(); expect(db.organization.findUnique).not.toHaveBeenCalled();
  });
});
