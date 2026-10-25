'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { trackAnalyticsPageView } from '@/lib/analytics';

const CONSENT_KEY = 'satrcrm_analytics_consent';
type ConsentState = 'unknown' | 'granted' | 'denied';

function isValidMeasurementId(value: string) {
  return /^G-[A-Z0-9-]+$/i.test(value);
}

export function GoogleAnalytics({ measurementId }: { measurementId?: string }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentState>('unknown');
  const [mounted, setMounted] = useState(false);

  const id = measurementId?.trim() ?? '';
  const enabled = isValidMeasurementId(id);

  useEffect(() => {
    if (!enabled) {
      setMounted(true);
      return;
    }

    // Reading consent only after mount keeps the server and browser markup
    // identical, while preventing the banner from flashing on every page
    // when a decision was already saved.
    try {
      const saved = window.localStorage.getItem(CONSENT_KEY);
      if (saved === 'granted' || saved === 'denied') setConsent(saved);
    } catch {
      // If storage is blocked, the banner remains available for this visit.
    }
    setMounted(true);
  }, [enabled]);

  useEffect(() => {
    if (enabled && consent === 'granted') {
      trackAnalyticsPageView(pathname);
    }
  }, [consent, enabled, pathname]);

  if (!enabled) return null;

  const chooseConsent = (next: Exclude<ConsentState, 'unknown'>) => {
    try {
      window.localStorage.setItem(CONSENT_KEY, next);
    } catch {
      // The in-memory state still applies for the current visit.
    }
    if (next === 'denied' && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
    }
    setConsent(next);
  };

  // Do not render the consent UI until the saved browser decision has been
  // read. This makes an accepted or rejected choice disappear immediately
  // and avoids a hydration/flash cycle on navigation.
  if (!mounted) return null;

  return (
    <>
      {consent === 'granted' ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
            strategy="afterInteractive"
          />
          <Script id="satrcrm-google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              window.gtag = function(){window.dataLayer.push(arguments);};
              window.gtag('js', new Date());
              window.gtag('consent', 'update', {
                analytics_storage: 'granted',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
              });
              window.gtag('config', '${id}', { send_page_view: false });
            `}
          </Script>
        </>
      ) : null}

      {consent === 'unknown' ? (
        <aside
          dir="rtl"
          className="fixed inset-x-4 bottom-4 z-[100] mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
          aria-label="إعدادات التحليلات"
        >
          <div>
            <p className="font-bold text-slate-900 dark:text-white">تحسين تجربة SatrCRM</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              نستخدم Google Analytics لفهم استخدام الصفحات وتحسين النظام. لن يبدأ التتبع قبل موافقتك.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => chooseConsent('denied')}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              رفض
            </button>
            <button
              type="button"
              onClick={() => chooseConsent('granted')}
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              السماح بالتحليلات
            </button>
          </div>
        </aside>
      ) : null}
    </>
  );
}
