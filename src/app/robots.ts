import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

const SITE_URL = 'https://satrcrm.com';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const hostname = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '').split(',')[0].trim().split(':')[0].toLowerCase();

  if (hostname === 'app.satrcrm.com' || hostname === 'www.satrcrm.com') {
    return { rules: [{ userAgent: '*', disallow: ['/'] }] };
  }

  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard', '/admin', '/settings', '/profile', '/clients/', '/contacts/', '/deals/', '/leads/', '/tasks/', '/tickets/', '/messages/', '/chat', '/calendar', '/imports', '/onboarding', '/login', '/forgot-password', '/reset-password'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
