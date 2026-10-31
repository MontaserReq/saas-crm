'use client';

import { Ban, Clock3, LockKeyhole, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import type { AiResearchStatus } from '@/lib/ai/researchSettings';

export function ComingSoonPanel({ status = 'OFF' }: { status?: AiResearchStatus }) {
  const { language } = useI18n();
  const ar = language === 'ar';
  const disabled = status === 'OFF';

  return (
    <div className="flex min-h-[460px] items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl rounded-3xl border border-brand-200 bg-white p-8 text-center shadow-sm dark:border-brand-900/60 dark:bg-slate-900">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
          {disabled ? <Ban className="h-8 w-8" /> : <Sparkles className="h-8 w-8" />}
        </div>
        <div className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${disabled ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
          {disabled ? <Ban className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
          {disabled ? (ar ? 'متوقفة' : 'Disabled') : (ar ? 'نسخة تجريبية' : 'Beta')}
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {ar ? 'البحث الذكي عن العملاء' : 'AI Customer Research'}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
          {disabled
            ? (ar ? 'البحث الذكي متوقف حاليًا من إعدادات مدير المنصة.' : 'Smart research is currently disabled by the Platform Admin.')
            : (ar ? 'البحث الذكي يعمل حاليًا بنسخة تجريبية.' : 'Smart research is currently available in beta.')}
        </p>
        <div className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-400">
          <LockKeyhole className="h-4 w-4" />
          {ar ? 'الميزة والصلاحيات مقفلة مؤقتًا' : 'Feature and permissions are temporarily locked'}
        </div>
      </div>
    </div>
  );
}
