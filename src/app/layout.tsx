import './globals.css';
import { ThemeProvider } from 'next-themes';
import { I18nProvider } from '@/lib/i18n/context';
import { DialogProvider } from '@/lib/dialog/context';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CodeLine JO - PR & School Operations Platform',
  description: 'Enterprise School Operations, PR Assignments, and Ticket Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Tajawal:wght@300;400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground dark:bg-slate-950 antialiased font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <I18nProvider>
            <DialogProvider>{children}</DialogProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
