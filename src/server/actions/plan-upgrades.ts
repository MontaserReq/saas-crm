'use server';

import { requireAuth } from '@/lib/auth/session';
import { PlanUpgradeService } from '@/server/services/PlanUpgradeService';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';

function failure(error: unknown) {
  const codes = ['FORBIDDEN', 'ORGANIZATION_NOT_FOUND', 'PLAN_UNAVAILABLE', 'PLAN_PRICING_UNAVAILABLE', 'REQUEST_PENDING', 'UPGRADE_REQUIRED', 'RENEWAL_INTERVAL_MISMATCH', 'REQUEST_NOT_FOUND', 'REQUEST_REVIEWED', 'PLAN_CHANGED', 'PAYMENT_MISMATCH', 'PAYMENT_NOT_CONFIRMED', 'PAYMENT_CONFIRMATION_REQUIRED', 'BILLING_POLICY_REQUIRED'];
  return { success: false as const, error: error instanceof ZodError ? 'INVALID_INPUT' : error instanceof Error && codes.includes(error.message) ? error.message : 'RETRY' };
}
function refresh() {
  revalidatePath('/settings/subscription');
  revalidatePath('/admin', 'layout');
}
export async function requestPlanUpgradeAction(input: unknown) {
  try { await PlanUpgradeService.request(await requireAuth(), input); refresh(); return { success: true as const }; } catch (error) { return failure(error); }
}
export async function assignCompanyPlanAction(input: unknown) {
  try { await PlanUpgradeService.assign(await requireAuth(), input); refresh(); return { success: true as const }; } catch (error) { return failure(error); }
}
export async function reviewPlanUpgradeAction(input: unknown) {
  try { await PlanUpgradeService.decide(await requireAuth(), input); refresh(); return { success: true as const }; } catch (error) { return failure(error); }
}
export async function confirmPlanPaymentAction(input: unknown) {
  try { const result = await PlanUpgradeService.confirmPayment(await requireAuth(), input); refresh(); return { success: true as const, ...result }; } catch (error) { return failure(error); }
}
export async function activateConfirmedPlanAction(input: unknown) {
  try { const result = await PlanUpgradeService.activateConfirmed(await requireAuth(), input); refresh(); return { success: true as const, ...result }; } catch (error) { return failure(error); }
}
export async function requestSubscriptionSupportAction(input: unknown) {
  try { await PlanUpgradeService.requestSupport(await requireAuth(), input); revalidatePath('/trial-expired'); return { success: true as const }; } catch (error) { return failure(error); }
}
