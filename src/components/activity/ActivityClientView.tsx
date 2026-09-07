'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n/context';
import { formatDate } from '@/lib/utils';
import { Activity } from 'lucide-react';
import Link from 'next/link';

interface ActivityItem {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date | string;
  actor: {
    name: string;
  } | null;
  ticket: {
    id: string;
    ticketNumber: string;
    subject: string;
    school: {
      name: string;
    } | null;
  } | null;
}

interface ActivityClientViewProps {
  activities: ActivityItem[];
}

export function ActivityClientView({ activities }: ActivityClientViewProps) {
  const { t, language } = useI18n();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t('activityChanges.title')}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t('activityChanges.description')}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="relative ps-6 space-y-6 before:absolute before:start-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {activities.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              {t('activityChanges.noActivity')}
            </div>
          ) : (
            activities.map((act) => (
              <div key={act.id} className="relative text-xs space-y-1">
                <div className="absolute -start-6 top-0.5 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center">
                  <Activity className="w-3 h-3 text-brand-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{act.title}</span>
                  <span className="text-[10px] text-slate-400">{formatDate(act.createdAt, language)}</span>
                </div>
                {act.description && <p className="text-slate-600 dark:text-slate-400">{act.description}</p>}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-brand-600 font-semibold">
                    {act.actor ? `${t('tickets.byAuthor')} ${act.actor.name}` : (language === 'ar' ? 'حدث نظام' : 'System event')}
                  </span>
                  {act.ticket && (
                    <Link
                      href={`/tickets/${act.ticket.id}`}
                      className="text-[10px] text-slate-400 hover:text-brand-600 font-medium"
                    >
                      {act.ticket.ticketNumber} {act.ticket.school ? <> &bull; {act.ticket.school.name}</> : null}
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
