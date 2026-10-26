import './globals.css';
import { ThemeProvider } from 'next-themes';
import { I18nProvider } from '@/lib/i18n/context';
import { DialogProvider } from '@/lib/dialog/context';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { getCurrentUser } from '@/lib/auth/session';
import { headers } from 'next/headers';
import type { Metadata } from 'next';

const SITE_URL = 'https://satrcrm.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'SatrCRM',
  title: {
    default: 'SatrCRM | CRM عربي لإدارة العملاء والمبيعات والفرق',
    template: '%s | SatrCRM',
  },
  description: 'SatrCRM منصة CRM عربية وإنجليزية لإدارة العملاء وجهات الاتصال والمبيعات والمهام والتذاكر وعمل الفريق في مساحة عمل واحدة.',
  keywords: [
    'SatrCRM', 'CRM', 'CRM عربي', 'نظام إدارة العملاء', 'إدارة العملاء',
    'إدارة المبيعات', 'مسارات المبيعات', 'إدارة المهام', 'تذاكر الدعم',
    'Arabic CRM', 'CRM software', 'sales pipeline', 'customer relationship management',
  ],
  authors: [{ name: 'SatrCRM' }],
  creator: 'SatrCRM',
  publisher: 'SatrCRM',
  manifest: '/manifest.webmanifest',
  // Public routes override this default with indexable metadata. The default
  // keeps authenticated and app-only routes out of search results.
  robots: { index: false, follow: false, googleBot: { index: false, follow: false, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  icons: {
    icon: [
      { url: '/branding/icons/favicon.ico', type: 'image/x-icon' },
      { url: '/branding/icons/app-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/branding/icons/app-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/branding/icons/favicon.ico',
    apple: '/branding/icons/app-180.png',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Theme and language are personal preferences. Scoping the browser storage
  // key to the authenticated user prevents one account from affecting another
  // account on the same browser or device.
  let preferenceScope = 'guest';
  try {
    preferenceScope = (await getCurrentUser())?.id ?? 'guest';
  } catch {
    // Public/auth pages must still render if the session cannot be read.
  }

  const themeStorageKey = `satrcrm:theme:${preferenceScope}`;
  const localeHeaders = await headers();
  const locale = localeHeaders.get('x-satrcrm-locale') === 'en' ? 'en' : 'ar';

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground dark:bg-slate-950 antialiased">
        <ThemeProvider
          key={themeStorageKey}
          attribute="class"
          storageKey={themeStorageKey}
          defaultTheme="system"
          enableSystem
        >
          <I18nProvider key={preferenceScope} preferenceScope={preferenceScope}>
            <GoogleAnalytics measurementId={process.env.GA_MEASUREMENT_ID} />
            <DialogProvider>{children}</DialogProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
