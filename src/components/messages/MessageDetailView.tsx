'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import {
  ArrowLeft,
  ArrowRight,
  Reply,
  Download,
  Paperclip,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Clock,
} from 'lucide-react';
import { ComposeMessageModal } from './ComposeMessageModal';

interface MessageAttachmentItem {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date | string;
}

interface MessageDetailProps {
  message: {
    id: string;
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
    recipients: Array<{
      id: string;
      type: string;
      isRead: boolean;
      readAt?: Date | null;
      user: {
        id: string;
        name: string;
        email: string;
        avatar?: string | null;
        department?: { id: string; name: string; code: string } | null;
      };
    }>;
    attachments: MessageAttachmentItem[];
  };
  currentUserId: string;
}

export const MessageDetailView: React.FC<MessageDetailProps> = ({ message, currentUserId }) => {
  const { t, language, direction } = useI18n();
  const isRTL = direction === 'rtl';
  const router = useRouter();

  const [isReplyOpen, setIsReplyOpen] = useState(false);

  const formatDate = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    return d.toLocaleDateString(language === 'ar' ? 'ar-JO' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string, filename: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
    if (mimeType.includes('sheet') || filename.endsWith('.xlsx') || filename.endsWith('.csv'))
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
    return <FileText className="w-5 h-5 text-brand-600 dark:text-brand-400" />;
  };

  const toRecipients = message.recipients.filter((r) => r.type === 'TO');
  const ccRecipients = message.recipients.filter((r) => r.type === 'CC');

  const isCurrentSender = message.sender.id === currentUserId;

  const replySubject = message.subject.startsWith('Re:') || message.subject.startsWith('رد:')
    ? message.subject
    : `Re: ${message.subject}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Navigation & Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/messages"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-charcoal-700 dark:text-charcoal-300 hover:text-charcoal-900 dark:hover:text-white bg-white dark:bg-charcoal-900 border border-charcoal-200 dark:border-charcoal-800 rounded-xl hover:bg-charcoal-50 dark:hover:bg-charcoal-800 transition-colors shadow-xs"
        >
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{t('messages.backToMessages')}</span>
        </Link>

        {!isCurrentSender && (
          <button
            onClick={() => setIsReplyOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <Reply className="w-4 h-4" />
            <span>{t('messages.reply')}</span>
          </button>
        )}
      </div>

      {/* Main Message Card */}
      <div className="bg-white dark:bg-charcoal-900 rounded-2xl border border-charcoal-200 dark:border-charcoal-800 shadow-sm overflow-hidden">
        {/* Subject Header */}
        <div className="p-6 border-b border-charcoal-100 dark:border-charcoal-800 bg-charcoal-50/50 dark:bg-charcoal-800/40">
          <h1 className="text-xl sm:text-2xl font-bold text-charcoal-950 dark:text-charcoal-50">
            {message.subject}
          </h1>
        </div>

        {/* Sender & Recipients Details */}
        <div className="p-6 border-b border-charcoal-100 dark:border-charcoal-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Sender Info */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 font-bold text-base flex items-center justify-center shadow-xs">
                {message.sender.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-charcoal-950 dark:text-charcoal-50 text-sm sm:text-base">
                    {message.sender.name}
                  </span>
                  {message.sender.department && (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800/50 font-medium">
                      {message.sender.department.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
                  {message.sender.email}
                </p>
              </div>
            </div>

            {/* Date */}
            <div className="flex items-center gap-1.5 text-xs text-charcoal-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDate(message.createdAt)}</span>
            </div>
          </div>

          {/* Recipients List */}
          <div className="pt-2 space-y-2 border-t border-charcoal-100 dark:border-charcoal-800/60 text-xs">
            {/* TO */}
            <div className="flex items-start gap-2">
              <span className="font-bold text-charcoal-500 dark:text-charcoal-400 min-w-[2.5rem] pt-0.5">
                {t('messages.to')}:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {toRecipients.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-brand-50 dark:bg-brand-950/40 text-brand-800 dark:text-brand-200 border border-brand-200/60 dark:border-brand-800/40 rounded-lg text-xs font-medium"
                  >
                    <span>{r.user.name}</span>
                    {r.user.department && (
                      <span className="text-[10px] text-charcoal-500 dark:text-charcoal-400 font-normal">
                        ({r.user.department.name})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* CC */}
            {ccRecipients.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="font-bold text-charcoal-500 dark:text-charcoal-400 min-w-[2.5rem] pt-0.5">
                  {t('messages.cc')}:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ccRecipients.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-charcoal-100 dark:bg-charcoal-800 text-charcoal-700 dark:text-charcoal-300 rounded-lg text-xs font-medium border border-charcoal-200 dark:border-charcoal-700"
                    >
                      <span>{r.user.name}</span>
                      {r.user.department && (
                        <span className="text-[10px] text-charcoal-400 font-normal">
                          ({r.user.department.name})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Message Content Body */}
        <div className="p-6 sm:p-8 min-h-[180px]">
          <div className="text-charcoal-800 dark:text-charcoal-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans">
            {message.content}
          </div>
        </div>

        {/* Attachments Section */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="p-6 bg-charcoal-50/50 dark:bg-charcoal-800/30 border-t border-charcoal-100 dark:border-charcoal-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-charcoal-700 dark:text-charcoal-300">
              <Paperclip className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>
                {t('messages.attachments')} ({message.attachments.length})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {message.attachments.map((att) => {
                const isImage = att.mimeType.startsWith('image/');
                const downloadUrl = `/api/message-attachments/${att.id}`;

                return (
                  <div
                    key={att.id}
                    className="p-3 bg-white dark:bg-charcoal-800 border border-charcoal-200 dark:border-charcoal-700 rounded-xl shadow-xs hover:border-brand-400 dark:hover:border-brand-600 transition-all flex flex-col justify-between"
                  >
                    {isImage ? (
                      <div className="mb-2 overflow-hidden rounded-lg bg-charcoal-100 dark:bg-charcoal-900 h-32 flex items-center justify-center">
                        <img
                          src={`${downloadUrl}?inline=true`}
                          alt={att.originalName}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      </div>
                    ) : null}

                    <div className="flex items-start gap-2.5 overflow-hidden">
                      <div className="p-2 rounded-lg bg-charcoal-50 dark:bg-charcoal-700 flex-shrink-0">
                        {getFileIcon(att.mimeType, att.originalName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-xs font-bold text-charcoal-900 dark:text-charcoal-100 truncate"
                          title={att.originalName}
                        >
                          {att.originalName}
                        </p>
                        <p className="text-[11px] text-charcoal-400">
                          {formatFileSize(att.size)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-charcoal-100 dark:border-charcoal-700 flex items-center justify-end">
                      <a
                        href={downloadUrl}
                        download={att.originalName}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/50 rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t('messages.downloadAttachment')}</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Reply Modal */}
      <ComposeMessageModal
        isOpen={isReplyOpen}
        onClose={() => setIsReplyOpen(false)}
        initialTo={[{ id: message.sender.id, name: message.sender.name, email: message.sender.email }]}
        initialSubject={replySubject}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
};
