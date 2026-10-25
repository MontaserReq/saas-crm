import type { Metadata } from 'next';
import PricingPage from '@/components/pricing/PricingPage';
import { getPublishedPlatformPlans } from '@/server/services/PlatformCatalogService';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Plans & Pricing | CodeLine JO',
  description: 'Compare CodeLine CRM plans for customers, sales, operations, and growing teams.',
};

export default async function PricingRoute() {
  return <PricingPage plans={await getPublishedPlatformPlans()} />;
}
