'use client';

import { MarketingShell, MarketingFaq, FinalCta } from '@/components/landing/MarketingShell';
import { PricingSection } from '@/components/landing/PricingSection';
import type { PlanConfig } from '@/lib/plans';

export default function PricingPage({ plans }: { plans: PlanConfig[] }) {
  return <MarketingShell pricing><PricingSection standalone plans={plans} /><MarketingFaq /><FinalCta /></MarketingShell>;
}
