'use client';

import { useEffect } from 'react';

function report(payload: Record<string, unknown>) {
  const body = JSON.stringify({ ...payload, path: window.location.pathname });
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/monitoring/client-error', new Blob([body], { type: 'application/json' }));
    return;
  }
  void fetch('/api/monitoring/client-error', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
}

export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => report({ message: event.message || 'Unhandled browser error', stack: event.error?.stack, filename: event.filename, line: event.lineno, column: event.colno });
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason : String(event.reason || 'Unhandled promise rejection');
      report({ message: reason instanceof Error ? reason.message : reason, stack: reason instanceof Error ? reason.stack : undefined });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, []);
  return null;
}
