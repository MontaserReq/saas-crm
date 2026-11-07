'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch('/api/monitoring/client-error', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: error.message || 'Page rendering error', stack: error.stack, path: window.location.pathname }) }).catch(() => undefined);
  }, [error]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center dark:bg-slate-950">
      <div className="max-w-md space-y-4"><p className="text-sm font-bold text-red-600">500</p><h1 className="text-2xl font-black text-slate-900 dark:text-white">حدث خطأ غير متوقع</h1><p className="text-sm text-slate-500 dark:text-slate-400">تم تسجيل المشكلة وسيتم التعامل معها.</p><button type="button" onClick={() => reset()} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700">إعادة المحاولة</button></div>
    </main>
  );
}
