import type { Metadata } from 'next';
import LandingPage from '@/components/landing/LandingPage';
import { getPublishedPlatformPlans } from '@/server/services/PlatformCatalogService';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CodeLine CRM | Turn Every Relationship Into Growth',
  description: 'Manage customers, organize your sales pipeline, and bring your team’s work together in one connected CRM workspace.',
};

export default async function HomePage() {
  return <LandingPage plans={await getPublishedPlatformPlans()} />;
}
