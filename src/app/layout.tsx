import './globals.css';
import { ThemeProvider } from 'next-themes';
import { I18nProvider } from '@/lib/i18n/context';
import { DialogProvider } from '@/lib/dialog/context';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { getCurrentUser } from '@/lib/auth/session';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CodeLine JO - CRM & Business Operations Platform',
  description: 'An all-in-one CRM and business operations workspace for growing teams.',
  icons: {
    icon: [
      { url: '/branding/icons/favicon.ico' },
      { url: '/branding/icons/app-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/branding/icons/app-512.png', sizes: '512x512', type: 'image/png' },
    ],
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

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground dark:bg-slate-950 antialiased">
        <GoogleAnalytics measurementId={process.env.GA_MEASUREMENT_ID} />
        <ThemeProvider
          key={themeStorageKey}
          attribute="class"
          storageKey={themeStorageKey}
          defaultTheme="system"
          enableSystem
        >
          <I18nProvider key={preferenceScope} preferenceScope={preferenceScope}>
            <DialogProvider>{children}</DialogProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
