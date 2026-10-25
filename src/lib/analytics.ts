export type AnalyticsParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function queueGtag(...args: unknown[]) {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag === 'function') {
    window.gtag(...args);
  } else {
    window.dataLayer.push(args);
  }
}

export function trackAnalyticsEvent(name: string, params: AnalyticsParams = {}) {
  queueGtag('event', name, params);
}

export function trackAnalyticsPageView(pathname: string) {
  if (typeof window === 'undefined') return;

  queueGtag('event', 'page_view', {
    page_title: document.title,
    page_location: window.location.href,
    page_path: pathname,
  });
}
