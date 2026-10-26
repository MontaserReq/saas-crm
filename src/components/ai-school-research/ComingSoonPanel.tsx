'use client';

import { Clock3, LockKeyhole, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

export function ComingSoonPanel() {
  const { language } = useI18n();
  const ar = language === 'ar';

  return (
    <div className="flex min-h-[460px] items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl rounded-3xl border border-brand-200 bg-white p-8 text-center shadow-sm dark:border-brand-900/60 dark:bg-slate-900">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
          <Sparkles className="h-8 w-8" />
        </div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <Clock3 className="h-3.5 w-3.5" />
          {ar ? 'قريبًا' : 'Coming soon'}
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {ar ? 'البحث الذكي عن العملاء' : 'AI Customer Research'}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
          {ar
            ? 'هذه الميزة قيد التطوير حاليًا وستتوفر قريبًا. سيتم فتح البحث والصلاحيات عند إطلاقها رسميًا.'
            : 'This feature is currently under development and will be available soon. Research and its permissions will unlock after the official launch.'}
        </p>
        <div className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-400">
          <LockKeyhole className="h-4 w-4" />
          {ar ? 'الميزة والصلاحيات مقفلة مؤقتًا' : 'Feature and permissions are temporarily locked'}
        </div>
      </div>
    </div>
  );
}
