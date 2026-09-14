'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

export function TicketAccessRestricted() {
  const { t } = useI18n();
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4 my-12">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
        <ShieldCheck className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('tickets.accessRestricted')}</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('tickets.accessRestrictedDesc')}</p>
      <div className="pt-2">
        <Link href="/tickets" className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors inline-block">
          {t('tickets.backToTickets')}
        </Link>
      </div>
    </div>
  );
}
