import prisma from '@/lib/db/prisma';
import type { PlanConfig } from '@/lib/plans';

export async function getPublishedPlatformPlans(): Promise<PlanConfig[]> {
  const plans = await prisma.platformPlan.findMany({ where: { isActive: true, OR: [{ availability: 'contact_sales' }, { availability: 'self_serve', monthlyPrice: { not: null }, annualPrice: { not: null } }] }, orderBy: { createdAt: 'asc' } });
  const publishedPlans: PlanConfig[] = plans.map(plan => ({ id: plan.slug, name: plan.name, description: { en: plan.descriptionEn, ar: plan.descriptionAr }, monthlyPrice: plan.monthlyPrice?.toFixed(2) ?? null, annualPrice: plan.annualPrice?.toFixed(2) ?? null, currency: plan.currency, pricingVersion: plan.pricingVersion, userLimit: plan.userLimit, recommended: plan.recommended, features: JSON.parse(plan.features), availability: plan.availability === 'contact_sales' ? 'contact_sales' : 'self_serve' }));
  return publishedPlans.sort((a, b) => {
    const priceA = a.monthlyPrice === null ? Number.POSITIVE_INFINITY : Number(a.monthlyPrice);
    const priceB = b.monthlyPrice === null ? Number.POSITIVE_INFINITY : Number(b.monthlyPrice);
    return priceA - priceB || a.name.localeCompare(b.name);
  });
}

export async function getPlatformDefaults() {
  const settings = await prisma.platformSetting.findMany();
  return Object.fromEntries(settings.map(setting => [setting.key, setting.value]));
}
