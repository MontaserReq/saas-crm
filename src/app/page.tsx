import type { Metadata } from 'next';
import LandingPage from '@/components/landing/LandingPage';
import { getPublishedPlatformPlans } from '@/server/services/PlatformCatalogService';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'SatrCRM | نظام CRM عربي لإدارة العملاء والمبيعات والفرق',
  description: 'نظّم العملاء وجهات الاتصال والعملاء المحتملين والصفقات ومسارات المبيعات والمهام والتذاكر والتقويم ومحادثة الفريق في منصة CRM عربية وإنجليزية.',
  alternates: {
    canonical: '/',
    languages: { ar: '/', en: '/en', 'x-default': '/' },
  },
  openGraph: {
    title: 'SatrCRM | نظام CRM عربي لإدارة العملاء والمبيعات والفرق',
    description: 'مساحة عمل واحدة لإدارة العملاء والمبيعات والعمليات اليومية وعمل الفريق.',
    url: 'https://satrcrm.com/',
    locale: 'ar_JO',
    type: 'website',
    siteName: 'SatrCRM',
    images: [{ url: '/branding/satrcrm-en-purple.png', width: 762, height: 192, alt: 'SatrCRM CRM platform' }],
  },
  twitter: { card: 'summary_large_image', title: 'SatrCRM | نظام CRM عربي لإدارة العملاء والمبيعات والفرق', description: 'منصة CRM عربية وإنجليزية لإدارة العملاء والمبيعات وعمل الفريق.', images: ['/branding/satrcrm-en-purple.png'] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
};

export default async function HomePage() {
  return <LandingPage plans={await getPublishedPlatformPlans()} />;
}
