import type { Metadata } from 'next';
import PricingPage from '@/components/pricing/PricingPage';
import { getPublishedPlatformPlans } from '@/server/services/PlatformCatalogService';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'أسعار وباقات SatrCRM | CRM لإدارة العملاء والمبيعات',
  description: 'قارن باقات SatrCRM لإدارة العملاء وجهات الاتصال والمبيعات ومسارات البيع والمهام والتذاكر وعمل الفريق بالعربية والإنجليزية.',
  alternates: {
    canonical: '/pricing',
    languages: { ar: '/pricing', en: '/pricing', 'x-default': '/pricing' },
  },
  openGraph: {
    title: 'أسعار وباقات SatrCRM | CRM لإدارة العملاء والمبيعات',
    description: 'اختر الباقة المناسبة لفريقك ونظّم العملاء والمبيعات والعمليات اليومية من مكان واحد.',
    url: 'https://satrcrm.com/pricing',
    locale: 'ar_JO',
    type: 'website',
    siteName: 'SatrCRM',
    images: [{ url: '/branding/satrcrm-en-purple.png', width: 762, height: 192, alt: 'SatrCRM CRM platform' }],
  },
  twitter: { card: 'summary_large_image', title: 'أسعار وباقات SatrCRM | CRM لإدارة العملاء والمبيعات', description: 'اختر الباقة المناسبة لفريقك ونظّم العملاء والمبيعات والعمليات اليومية من مكان واحد.', images: ['/branding/satrcrm-en-purple.png'] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
};

export default async function PricingRoute() {
  return <PricingPage plans={await getPublishedPlatformPlans()} />;
}
