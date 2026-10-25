export type BillingInterval = 'monthly' | 'annual';

export type PlanId = string;

export type PlanConfig = {
  id: PlanId;
  name: string;
  description: { en: string; ar: string };
  monthlyPrice: string | null;
  annualPrice: string | null;
  currency: string;
  pricingVersion: number;
  userLimit: number | null;
  recommended?: boolean;
  features: string[];
  availability: 'self_serve' | 'contact_sales';
};

function minorUnits(value: string) {
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function fromMinorUnits(value: number) {
  return (value / 100).toFixed(2);
}

export function getAnnualMonthlyEquivalent(plan: PlanConfig) {
  if (plan.annualPrice === null) return null;
  return fromMinorUnits(Math.round(minorUnits(plan.annualPrice) / 12));
}

export function getAnnualTotal(plan: PlanConfig) {
  return plan.annualPrice;
}

export function getAnnualSavings(plan: PlanConfig) {
  const total = getAnnualTotal(plan);
  return total === null || plan.monthlyPrice === null ? null : fromMinorUnits(minorUnits(plan.monthlyPrice) * 12 - minorUnits(total));
}
