'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Clock, Mail, Ticket } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { markNotificationReadAction, markAllNotificationsReadAction } from '@/server/actions/notifications';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string | Date;
}

export function NotificationDropdown({ initialNotifications = [] }: { initialNotifications?: NotificationItem[] }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const { t, language } = useI18n();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)));
      await markNotificationReadAction(n.id);
    }
    setIsOpen(false);

    if (n.entityType === 'ticket' && n.entityId) {
      router.push(`/tickets/${n.entityId}`);
    } else if (n.entityType === 'message' && n.entityId) {
      router.push(`/messages/${n.entityId}`);
    } else if (n.entityType === 'schoolApprovalRequest') {
      router.push('/admin/approval-requests');
    } else if (n.entityType === 'school') {
      router.push('/schools');
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await markAllNotificationsReadAction();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 end-1 min-w-[16px] h-4 px-1 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute top-full end-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
          style={{ maxHeight: 'min(500px, 85vh)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{t('nav.notifications')}</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800/60">
                  {unreadCount} {t('notifications.newBadge')}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{t('notifications.markAllRead')}</span>
              </button>
            )}
          </div>

          {/* List items */}
          <div className="overflow-y-auto max-h-[360px] divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center text-sm text-slate-400 space-y-1">
                <Bell className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                <p className="font-medium">{t('notifications.noNotifications')}</p>
                <p className="text-xs text-slate-400">{t('notifications.caughtUp')}</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                    !n.isRead ? 'bg-brand-50/40 dark:bg-brand-950/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold">
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0" />
                      )}
                      <p className={!n.isRead ? 'text-brand-700 dark:text-brand-300' : 'text-slate-800 dark:text-slate-200'}>
                        {n.title}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatDate(n.createdAt, language)}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {n.message}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 text-center bg-slate-50/50 dark:bg-slate-800/50">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline inline-block py-0.5"
            >
              {t('dashboard.viewAll')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
