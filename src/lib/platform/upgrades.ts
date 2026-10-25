import { z } from 'zod';

export const upgradeInput = z.object({
  planId: z.string().trim().min(1).max(100),
  billingInterval: z.enum(['monthly', 'annual']),
  reason: z.string().trim().max(2000).default(''),
}).strict();
export const assignmentInput = upgradeInput.extend({ organizationId: z.string().trim().min(1).max(100) }).strict();
export const decisionInput = z.object({
  id: z.string().trim().min(1).max(100),
  decision: z.enum(['REJECTED', 'CANCELLED']),
  reviewNote: z.string().trim().max(2000).default(''),
}).strict();
export const paymentConfirmationInput = z.object({
  id: z.string().trim().min(1).max(100),
  amount: z.union([z.string(), z.number()]).transform(value => String(value).trim()).refine(value => /^\d+(?:\.\d{1,2})?$/.test(value), 'Invalid amount'),
  currency: z.string().trim().min(3).max(12).regex(/^[A-Za-z]{3,12}$/).transform(value => value.toUpperCase()),
  reference: z.string().trim().max(200).default(''),
  note: z.string().trim().max(2000).default(''),
}).strict();
export const activationInput = z.object({ id: z.string().trim().min(1).max(100) }).strict();
export const subscriptionSupportInput = z.object({ message: z.string().trim().max(2000).default('') }).strict();

type ComparablePlan = { id: string; monthlyPrice: unknown; userLimit: number | null };
function monetaryMinorUnits(value: unknown) {
  const normalized = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function isPlanUpgrade(current: ComparablePlan | null, target: ComparablePlan) {
  if (!current) return true;
  if (current.id === target.id) return false;
  if (target.userLimit === null && current.userLimit !== null) return true;
  if (current.userLimit === null) return false;
  const currentPrice = monetaryMinorUnits(current.monthlyPrice);
  const targetPrice = monetaryMinorUnits(target.monthlyPrice);
  return target.userLimit !== null && target.userLimit > current.userLimit &&
    currentPrice !== null && targetPrice !== null && targetPrice >= currentPrice;
}

/**
 * Adds whole UTC calendar months while clamping to the target month's final
 * day. This avoids Date#setUTCMonth overflow (for example, January 31 becoming
 * March 3) and preserves the authoritative confirmation time-of-day.
 */
export function addUtcCalendarMonths(value: Date, months: number) {
  if (!Number.isInteger(months) || months <= 0) throw new Error('INVALID_BILLING_PERIOD');
  const result = new Date(value.getTime());
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const finalDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, finalDay));
  return result;
}
