import type { Metadata } from 'next';
import { getPublishedPlatformPlans } from '@/server/services/PlatformCatalogService';
import LocalizedLandingPage from '@/components/landing/LocalizedLandingPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'SatrCRM | Arabic & English CRM for Customers, Sales and Teams',
  description: 'SatrCRM is a bilingual CRM and business operations platform for managing customers, contacts, leads, deals, sales pipelines, tasks, tickets and team work.',
  alternates: {
    canonical: '/en',
    languages: { ar: '/', en: '/en', 'x-default': '/' },
  },
  openGraph: {
    title: 'SatrCRM | Arabic & English CRM for Customers, Sales and Teams',
    description: 'Connect customer relationships, sales pipelines and daily team work in one CRM workspace.',
    url: 'https://satrcrm.com/en',
    locale: 'en_US',
    type: 'website',
    siteName: 'SatrCRM',
    images: [{ url: '/branding/satrcrm-en-purple.png', width: 762, height: 192, alt: 'SatrCRM CRM platform' }],
  },
  twitter: { card: 'summary_large_image', title: 'SatrCRM | Arabic & English CRM for Customers, Sales and Teams', description: 'Connect customer relationships, sales pipelines and daily team work in one CRM workspace.', images: ['/branding/satrcrm-en-purple.png'] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
};

export default async function EnglishLandingRoute() {
  return <LocalizedLandingPage language="en" plans={await getPublishedPlatformPlans()} />;
}
