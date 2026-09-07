'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { useDialog } from '@/lib/dialog/context';
import {
  Mail,
  Send,
  Inbox,
  Paperclip,
  Search,
  Plus,
  Trash2,
  MailCheck,
  CheckCheck,
} from 'lucide-react';
import { ComposeMessageModal } from './ComposeMessageModal';
import { deleteMessageFromInboxAction } from '@/server/actions/messages';

interface MessageListItem {
  id: string;
  recipientId?: string;
  type?: 'TO' | 'CC';
  isRead?: boolean;
  readAt?: Date | null;
  subject: string;
  content: string;
  createdAt: Date | string;
  sender: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
    department?: { id: string; name: string; code: string } | null;
  };
  recipients?: Array<{
    type?: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
    };
  }>;
  attachmentsCount: number;
}

interface MessagesClientViewProps {
  inboxMessages: MessageListItem[];
  sentMessages: MessageListItem[];
  unreadCount: number;
  initialTab?: 'inbox' | 'sent';
}

export const MessagesClientView: React.FC<MessagesClientViewProps> = ({
  inboxMessages,
  sentMessages,
  unreadCount,
  initialTab = 'inbox',
}) => {
  const { t, language, direction } = useI18n();
  const { confirm } = useDialog();
  const isRTL = direction === 'rtl';
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatDate = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    return d.toLocaleDateString(language === 'ar' ? 'ar-JO' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDeleteFromInbox = async (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const ok = await confirm({
      title: isRTL ? 'حذف من الوارد' : 'Delete Message',
      message: t('messages.deleteConfirm') || (isRTL ? 'هل أنت متأكد من حذف هذه الرسالة من صندوق الوارد؟' : 'Are you sure you want to delete this message from your inbox?'),
      variant: 'confirmation',
      isDestructive: true,
      confirmText: isRTL ? 'حذف' : 'Delete',
      cancelText: isRTL ? 'إلغاء' : 'Cancel',
    });

    if (!ok) return;

    setDeletingId(messageId);
    const res = await deleteMessageFromInboxAction(messageId);
    if (res.success) {
      router.refresh();
    }
    setDeletingId(null);
  };

  const currentList = activeTab === 'inbox' ? inboxMessages : sentMessages;

  const filteredList = currentList.filter((msg) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      msg.subject.toLowerCase().includes(q) ||
      msg.content.toLowerCase().includes(q) ||
      msg.sender.name.toLowerCase().includes(q) ||
      (msg.recipients &&
        msg.recipients.some((r) => r.user.name.toLowerCase().includes(q)));

    if (activeTab === 'inbox' && unreadOnly) {
      return matchesSearch && msg.isRead === false;
    }

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-charcoal-900 p-6 rounded-2xl border border-charcoal-200 dark:border-charcoal-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-charcoal-900 dark:text-charcoal-50">
              {t('messages.title')}
            </h1>
            <p className="text-xs sm:text-sm text-charcoal-500 dark:text-charcoal-400 mt-0.5">
              {t('messages.subtitle')}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsComposeOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-sm rounded-xl shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <Plus className="w-4 h-4" />
          <span>{t('messages.compose')}</span>
        </button>
      </div>

      {/* Control Bar: Tabs, Search & Unread Filter */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center p-1 bg-charcoal-100 dark:bg-charcoal-800/80 rounded-xl border border-charcoal-200/60 dark:border-charcoal-700/60 max-w-fit">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'inbox'
                ? 'bg-white dark:bg-charcoal-900 text-brand-700 dark:text-brand-300 shadow-sm'
                : 'text-charcoal-600 dark:text-charcoal-400 hover:text-charcoal-900 dark:hover:text-charcoal-200'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>{t('messages.inbox')}</span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-[11px] font-extrabold bg-brand-600 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'sent'
                ? 'bg-white dark:bg-charcoal-900 text-brand-700 dark:text-brand-300 shadow-sm'
                : 'text-charcoal-600 dark:text-charcoal-400 hover:text-charcoal-900 dark:hover:text-charcoal-200'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>{t('messages.sent')}</span>
            <span className="text-xs text-charcoal-400">({sentMessages.length})</span>
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('messages.searchPlaceholder')}
              className="w-full ps-10 pe-4 py-2 bg-white dark:bg-charcoal-900 border border-charcoal-200 dark:border-charcoal-700 rounded-xl text-xs sm:text-sm text-charcoal-900 dark:text-charcoal-100 placeholder:text-charcoal-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
            />
          </div>

          {activeTab === 'inbox' && (
            <button
              onClick={() => setUnreadOnly(!unreadOnly)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all whitespace-nowrap ${
                unreadOnly
                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-800'
                  : 'bg-white dark:bg-charcoal-900 text-charcoal-600 dark:text-charcoal-300 border-charcoal-200 dark:border-charcoal-700 hover:bg-charcoal-50 dark:hover:bg-charcoal-800'
              }`}
            >
              {t('messages.unread')}
            </button>
          )}
        </div>
      </div>

      {/* Messages List — Professional Email Client Style */}
      <div className="bg-white dark:bg-charcoal-900 rounded-2xl border border-charcoal-200 dark:border-charcoal-800 shadow-sm overflow-hidden divide-y divide-charcoal-100 dark:divide-charcoal-800">
        {filteredList.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 dark:bg-brand-950/50 border border-brand-100 dark:border-brand-900/60 flex items-center justify-center text-brand-600 dark:text-brand-400">
              {activeTab === 'inbox' ? (
                <Inbox className="w-8 h-8" />
              ) : (
                <Send className="w-8 h-8" />
              )}
            </div>
            <h3 className="text-base font-bold text-charcoal-800 dark:text-charcoal-200 mb-1">
              {searchTerm
                ? t('messages.noMessagesMatch')
                : activeTab === 'inbox'
                ? t('messages.noMessagesInbox')
                : t('messages.noMessagesSent')}
            </h3>
            <p className="text-xs text-charcoal-500 dark:text-charcoal-400 max-w-sm mx-auto mb-5">
              {activeTab === 'inbox'
                ? isRTL
                  ? 'عندما يرسل لك زملاؤك رسائل داخلية، ستظهر هنا فوراً مع إشعارات مباشرة.'
                  : 'Internal communications sent by your team will appear here with instant notifications.'
                : isRTL
                ? 'يمكنك مراسلة أي فرد أو مجموعة في الفريق والإدارة بسهولة وسرية تامة.'
                : 'Send updates, agendas, or announcements directly to team members.'}
            </p>
            <button
              onClick={() => setIsComposeOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('messages.compose')}</span>
            </button>
          </div>
        ) : (
          filteredList.map((msg) => {
            const isUnread = activeTab === 'inbox' && msg.isRead === false;

            return (
              <Link
                key={msg.id}
                href={`/messages/${msg.id}`}
                className={`group flex items-start sm:items-center justify-between p-4 sm:px-6 hover:bg-charcoal-50/80 dark:hover:bg-charcoal-800/50 transition-colors ${
                  isUnread
                    ? 'bg-brand-50/40 dark:bg-brand-950/20'
                    : ''
                }`}
              >
                <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                  {/* Avatar / Indicator */}
                  <div className="relative flex-shrink-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                        isUnread
                          ? 'bg-brand-600 text-white shadow-sm ring-2 ring-brand-500/30'
                          : 'bg-charcoal-100 dark:bg-charcoal-800 text-charcoal-700 dark:text-charcoal-300'
                      }`}
                    >
                      {activeTab === 'inbox'
                        ? msg.sender.name.charAt(0)
                        : (msg.recipients?.[0]?.user.name || 'T').charAt(0)}
                    </div>
                    {isUnread && (
                      <span className="absolute -top-0.5 -end-0.5 w-3 h-3 bg-brand-600 border-2 border-white dark:border-charcoal-900 rounded-full" />
                    )}
                  </div>

                  {/* Sender/Recipients + Subject & Snippet */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span
                        className={`text-xs sm:text-sm truncate ${
                          isUnread
                            ? 'font-bold text-charcoal-950 dark:text-charcoal-50'
                            : 'font-semibold text-charcoal-800 dark:text-charcoal-200'
                        }`}
                      >
                        {activeTab === 'inbox' ? (
                          <>
                            {msg.sender.name}
                            {msg.type === 'CC' && (
                              <span className="ms-1.5 px-1.5 py-0.2 text-[10px] font-bold bg-charcoal-100 dark:bg-charcoal-800 text-charcoal-600 dark:text-charcoal-400 rounded">
                                CC
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-charcoal-400 me-1">
                              {isRTL ? 'إلى:' : 'To:'}
                            </span>
                            {msg.recipients?.map((r) => r.user.name).join(', ') || 'Team'}
                          </>
                        )}
                      </span>

                      {activeTab === 'inbox' && msg.sender.department && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-charcoal-100 dark:bg-charcoal-800 text-charcoal-600 dark:text-charcoal-300 font-medium hidden sm:inline">
                          {msg.sender.department.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <p
                        className={`text-xs sm:text-sm truncate ${
                          isUnread
                            ? 'font-medium text-charcoal-900 dark:text-charcoal-100'
                            : 'text-charcoal-600 dark:text-charcoal-400'
                        }`}
                      >
                        <span className={isUnread ? 'font-bold text-charcoal-950 dark:text-white me-1.5' : 'font-semibold text-charcoal-900 dark:text-charcoal-200 me-1.5'}>
                          {msg.subject}
                        </span>
                        <span className="text-charcoal-400 dark:text-charcoal-500 font-normal">
                          — {msg.content.replace(/\n/g, ' ').slice(0, 80)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right side: Attachment / Date / Delete */}
                <div className="flex items-center gap-3 ms-3 flex-shrink-0 text-xs text-charcoal-400">
                  {msg.attachmentsCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-brand-700 dark:text-brand-300 font-semibold bg-brand-50 dark:bg-brand-950/50 border border-brand-200/60 dark:border-brand-800/50 px-2 py-0.5 rounded-md">
                      <Paperclip className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      <span className="text-[11px]">{msg.attachmentsCount}</span>
                    </span>
                  )}

                  <span className="whitespace-nowrap text-[11px] sm:text-xs">
                    {formatDate(msg.createdAt)}
                  </span>

                  {activeTab === 'inbox' && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteFromInbox(e, msg.id)}
                      disabled={deletingId === msg.id}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-charcoal-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all focus:opacity-100"
                      title={isRTL ? 'إزالة من الوارد' : 'Delete from inbox'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Compose Message Modal */}
      <ComposeMessageModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
};
