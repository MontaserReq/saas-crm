'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n/context';
import { formatDate } from '@/lib/utils';
import { Bell, Clock, Mail, Ticket } from 'lucide-react';
import Link from 'next/link';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  createdAt: Date | string;
  isRead: boolean;
  entityType?: string | null;
  entityId?: string | null;
}

interface NotificationsClientViewProps {
  notifications: NotificationItem[];
}

export function NotificationsClientView({ notifications }: NotificationsClientViewProps) {
  const { t, language } = useI18n();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t('notifications.title')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('notifications.description')}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Bell className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold">{t('notifications.noNotifications')}</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 flex items-start justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                !n.isRead ? 'bg-purple-50/40 dark:bg-purple-950/20' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 mt-0.5 border border-brand-200/50 dark:border-brand-800/50">
                  {n.entityType === 'message' ? <Mail className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{n.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{n.message}</p>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 pt-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(n.createdAt, language)}</span>
                  </span>
                </div>
              </div>

              {n.entityType === 'ticket' && n.entityId && (
                <Link
                  href={`/tickets/${n.entityId}`}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 transition-colors"
                >
                  {t('notifications.viewTicket')}
                </Link>
              )}

              {n.entityType === 'message' && n.entityId && (
                <Link
                  href={`/messages/${n.entityId}`}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 transition-colors"
                >
                  {t('notifications.viewMessage')}
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
