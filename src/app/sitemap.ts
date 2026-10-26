import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

const SITE_URL = 'https://satrcrm.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const hostname = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '').split(',')[0].trim().split(':')[0].toLowerCase();

  if (hostname === 'app.satrcrm.com' || hostname === 'www.satrcrm.com') return [];

  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/en`, changeFrequency: 'weekly', priority: 0.95 },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'weekly', priority: 0.85 },
  ];
}
