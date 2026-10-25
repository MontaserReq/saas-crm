import { describe, expect, it } from 'vitest';
import { getAnnualMonthlyEquivalent, getAnnualSavings, getAnnualTotal, type PlanConfig } from '@/lib/plans';
import { planInput } from '@/lib/platform/validation';

const growth: PlanConfig = {
  id: 'growth', name: 'Growth', description: { en: '', ar: '' }, monthlyPrice: '99.00', annualPrice: '950.00', currency: 'JOD', pricingVersion: 3,
  userLimit: 10, features: [], availability: 'self_serve',
};

const baseInput = {
  slug: 'growth', name: 'Growth', descriptionEn: '', descriptionAr: '', monthlyPrice: '99.00', annualPrice: '950.00', currency: 'JOD',
  userLimit: 10, features: '', availability: 'self_serve' as const, recommended: true, isActive: true,
};

describe('authoritative pricing helpers and validation', () => {
  it('uses the explicit annual amount for display-only equivalents and savings', () => {
    expect(getAnnualMonthlyEquivalent(growth)).toBe('79.17');
    expect(getAnnualTotal(growth)).toBe('950.00');
    expect(getAnnualSavings(growth)).toBe('238.00');
  });

  it('keeps contact-sales pricing unavailable without inventing a fallback', () => {
    const enterprise = { ...growth, id: 'enterprise', monthlyPrice: null, annualPrice: null, availability: 'contact_sales' as const };
    expect(getAnnualMonthlyEquivalent(enterprise)).toBeNull();
    expect(getAnnualTotal(enterprise)).toBeNull();
    expect(getAnnualSavings(enterprise)).toBeNull();
  });

  it('requires exact monthly and annual values for self-service plans', () => {
    expect(planInput.safeParse(baseInput).success).toBe(true);
    expect(planInput.safeParse({ ...baseInput, annualPrice: null }).success).toBe(false);
    expect(planInput.safeParse({ ...baseInput, monthlyPrice: null }).success).toBe(false);
    expect(planInput.safeParse({ ...baseInput, annualPrice: '1188.01' }).success).toBe(false);
    expect(planInput.safeParse({ ...baseInput, monthlyPrice: 99 }).success).toBe(false);
  });

  it('requires contact-sales plans to keep both prices null and rejects legacy discount input', () => {
    expect(planInput.safeParse({ ...baseInput, availability: 'contact_sales', monthlyPrice: null, annualPrice: null }).success).toBe(true);
    expect(planInput.safeParse({ ...baseInput, availability: 'contact_sales' }).success).toBe(false);
    expect(planInput.safeParse({ ...baseInput, annualDiscountPercent: 17 }).success).toBe(false);
  });
});
