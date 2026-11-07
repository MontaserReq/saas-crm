'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch('/api/monitoring/client-error', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: error.message || 'Global application error', stack: error.stack, path: window.location.pathname }) }).catch(() => undefined);
  }, [error]);
  return <html lang="ar" dir="rtl"><body><main style={{ fontFamily: 'Arial, sans-serif', margin: '20vh auto', maxWidth: 520, padding: 24, textAlign: 'center' }}><h1>حدث خطأ غير متوقع</h1><p>تم تسجيل المشكلة. حاول مرة أخرى.</p><button type="button" onClick={() => reset()}>إعادة المحاولة</button></main></body></html>;
}
