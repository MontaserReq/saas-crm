'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/lib/i18n/context';
import {
  X,
  Paperclip,
  Send,
  Loader2,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  BookOpen,
} from 'lucide-react';
import { sendMessageAction, getTeamMembersForMessaging, getMessageTemplatesAction } from '@/server/actions/messages';

interface UserOption {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
  role?: {
    displayName: string;
    name: string;
  } | null;
}

interface ComposeMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialTo?: Array<{ id: string; name: string; email: string }>;
  initialSubject?: string;
}

export const ComposeMessageModal: React.FC<ComposeMessageModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialTo = [],
  initialSubject = '',
}) => {
  const { t, direction } = useI18n();
  const isRTL = direction === 'rtl';

  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [toRecipients, setToRecipients] = useState<UserOption[]>([]);
  const [ccRecipients, setCcRecipients] = useState<UserOption[]>([]);
  const [showCc, setShowCc] = useState(false);

  const [subject, setSubject] = useState(initialSubject);
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  const [searchToText, setSearchToText] = useState('');
  const [searchCcText, setSearchCcText] = useState('');
  const [isToDropdownOpen, setIsToDropdownOpen] = useState(false);
  const [isCcDropdownOpen, setIsCcDropdownOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Templates
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; subject?: string | null; body: string }>>([]);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toDropdownRef = useRef<HTMLDivElement>(null);
  const ccDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadTeamMembers();
      if (initialTo.length > 0) {
        setToRecipients(
          initialTo.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
          }))
        );
      }
      if (initialSubject) {
        setSubject(initialSubject);
      }
    } else {
      setToRecipients([]);
      setCcRecipients([]);
      setShowCc(false);
      setSubject('');
      setContent('');
      setAttachments([]);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialSubject]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toDropdownRef.current && !toDropdownRef.current.contains(event.target as Node)) {
        setIsToDropdownOpen(false);
      }
      if (ccDropdownRef.current && !ccDropdownRef.current.contains(event.target as Node)) {
        setIsCcDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadTeamMembers = async () => {
    setLoadingUsers(true);
    const [usersRes, templatesRes] = await Promise.all([
      getTeamMembersForMessaging(),
      getMessageTemplatesAction(),
    ]);
    if (usersRes.success && usersRes.users) {
      setAvailableUsers(usersRes.users);
    }
    if (templatesRes.success && templatesRes.templates) {
      setTemplates(
        templatesRes.templates.map((tpl: any) => ({
          id: tpl.id,
          name: (direction === 'rtl' ? tpl.titleAr || tpl.title : tpl.title) || tpl.code,
          subject: (direction === 'rtl' ? tpl.subjectAr || tpl.subject : tpl.subject) || null,
          body: (direction === 'rtl' ? tpl.contentAr || tpl.content : tpl.content) || '',
        }))
      );
    }
    setLoadingUsers(false);
  };

  const applyTemplate = (tpl: { subject?: string | null; body: string }) => {
    if (tpl.subject) setSubject(tpl.subject);
    setContent(tpl.body);
    setTemplateMenuOpen(false);
  };

  const handleSelectTo = (user: UserOption) => {
    if (!toRecipients.some((r) => r.id === user.id)) {
      setToRecipients([...toRecipients, user]);
      setCcRecipients(ccRecipients.filter((r) => r.id !== user.id));
    }
    setSearchToText('');
    setIsToDropdownOpen(false);
  };

  const handleRemoveTo = (userId: string) => {
    setToRecipients(toRecipients.filter((r) => r.id !== userId));
  };

  const handleSelectCc = (user: UserOption) => {
    if (!ccRecipients.some((r) => r.id === user.id) && !toRecipients.some((r) => r.id === user.id)) {
      setCcRecipients([...ccRecipients, user]);
    }
    setSearchCcText('');
    setIsCcDropdownOpen(false);
  };

  const handleRemoveCc = (userId: string) => {
    setCcRecipients(ccRecipients.filter((r) => r.id !== userId));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    const validFiles: File[] = [];
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) {
        setErrorMessage(
          isRTL
            ? `الملف "${f.name}" يتجاوز الحد الأقصى المسموح (10 ميغابايت).`
            : `File "${f.name}" is larger than the 10MB limit.`
        );
        continue;
      }
      validFiles.push(f);
    }

    setAttachments((prev) => [...prev, ...validFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string, filename: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    if (mimeType.includes('sheet') || filename.endsWith('.xlsx') || filename.endsWith('.csv'))
      return <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    return <FileText className="w-4 h-4 text-brand-600 dark:text-brand-400" />;
  };

  const filteredToUsers = availableUsers.filter(
    (u) =>
      !toRecipients.some((r) => r.id === u.id) &&
      (u.name.toLowerCase().includes(searchToText.toLowerCase()) ||
        u.email.toLowerCase().includes(searchToText.toLowerCase()) ||
        (u.department?.name && u.department.name.toLowerCase().includes(searchToText.toLowerCase())))
  );

  const filteredCcUsers = availableUsers.filter(
    (u) =>
      !ccRecipients.some((r) => r.id === u.id) &&
      !toRecipients.some((r) => r.id === u.id) &&
      (u.name.toLowerCase().includes(searchCcText.toLowerCase()) ||
        u.email.toLowerCase().includes(searchCcText.toLowerCase()) ||
        (u.department?.name && u.department.name.toLowerCase().includes(searchCcText.toLowerCase())))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (toRecipients.length === 0) {
      setErrorMessage(isRTL ? 'يرجى اختيار مستلم واحد على الأقل (إلى)' : 'Please select at least one recipient (To)');
      return;
    }
    if (!subject.trim()) {
      setErrorMessage(isRTL ? 'يرجى كتابة موضوع الرسالة' : 'Please enter message subject');
      return;
    }
    if (!content.trim()) {
      setErrorMessage(isRTL ? 'يرجى كتابة محتوى الرسالة' : 'Please enter message content');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('subject', subject.trim());
      formData.append('content', content.trim());
      formData.append('toUserIds', JSON.stringify(toRecipients.map((r) => r.id)));
      formData.append('ccUserIds', JSON.stringify(ccRecipients.map((r) => r.id)));

      for (const file of attachments) {
        formData.append('attachments', file);
      }

      const res = await sendMessageAction(formData);

      if (res.success) {
        setSuccessMessage(t('messages.messageSentSuccess') || (isRTL ? 'تم إرسال الرسالة بنجاح!' : 'Message sent successfully!'));
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 700);
      } else {
        setErrorMessage(res.error || (isRTL ? 'فشل إرسال الرسالة' : 'Failed to send message'));
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isRTL ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-charcoal-950/60 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-3xl bg-white dark:bg-charcoal-900 rounded-2xl shadow-2xl border border-charcoal-200 dark:border-charcoal-800 flex flex-col max-h-[90vh] overflow-hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header - Email Composer Style */}
        <div className="flex items-center justify-between px-6 py-4 bg-charcoal-50/80 dark:bg-charcoal-800/60 border-b border-charcoal-200 dark:border-charcoal-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-charcoal-900 dark:text-charcoal-50">
                {t('messages.compose')}
              </h2>
              <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
                {t('messages.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-200 rounded-lg hover:bg-charcoal-100 dark:hover:bg-charcoal-800 transition-colors focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body: To -> CC -> Subject -> Message -> Attachments */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto p-6 space-y-4">
          {/* Status Alerts */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-center gap-3 text-xs sm:text-sm text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center gap-3 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. TO Field */}
          <div className="relative border-b border-charcoal-100 dark:border-charcoal-800 pb-3" ref={toDropdownRef}>
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-charcoal-500 dark:text-charcoal-400 pt-2 min-w-[3rem]">
                {t('messages.to')}:
              </span>
              <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[38px]">
                {toRecipients.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 text-xs font-semibold rounded-lg border border-brand-200 dark:border-brand-800/60"
                  >
                    <span>{user.name}</span>
                    {user.department && (
                      <span className="text-[10px] text-charcoal-500 dark:text-charcoal-400 font-normal">
                        ({user.department.name})
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveTo(user.id)}
                      className="hover:text-rose-600 focus:outline-none"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={searchToText}
                  onChange={(e) => {
                    setSearchToText(e.target.value);
                    setIsToDropdownOpen(true);
                  }}
                  onFocus={() => setIsToDropdownOpen(true)}
                  placeholder={toRecipients.length === 0 ? t('messages.selectRecipients') : ''}
                  className="flex-1 min-w-[140px] bg-transparent border-none outline-none text-xs sm:text-sm text-charcoal-900 dark:text-charcoal-100 placeholder:text-charcoal-400 py-1"
                />
              </div>
              {!showCc && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline pt-2 focus:outline-none"
                >
                  + {t('messages.cc')}
                </button>
              )}
            </div>

            {/* To Dropdown */}
            {isToDropdownOpen && (
              <div className="absolute top-full start-12 end-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-charcoal-800 border border-charcoal-200 dark:border-charcoal-700 rounded-xl shadow-lg z-30 divide-y divide-charcoal-100 dark:divide-charcoal-700/50">
                {loadingUsers ? (
                  <div className="p-3 text-center text-xs text-charcoal-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                    {t('common.loading')}
                  </div>
                ) : filteredToUsers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-charcoal-400">
                    {t('common.search')}
                  </div>
                ) : (
                  filteredToUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectTo(user)}
                      className="w-full flex items-center justify-between p-2.5 hover:bg-brand-50/60 dark:hover:bg-brand-950/40 text-start transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold text-xs">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-charcoal-900 dark:text-charcoal-100">
                            {user.name}
                          </div>
                          <div className="text-[11px] text-charcoal-400">{user.email}</div>
                        </div>
                      </div>
                      {user.department && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-charcoal-100 dark:bg-charcoal-700 text-charcoal-600 dark:text-charcoal-300 font-medium">
                          {user.department.name}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 2. CC Field */}
          {showCc && (
            <div className="relative border-b border-charcoal-100 dark:border-charcoal-800 pb-3" ref={ccDropdownRef}>
              <div className="flex items-start gap-3">
                <span className="text-xs font-bold text-charcoal-500 dark:text-charcoal-400 pt-2 min-w-[3rem]">
                  {t('messages.cc')}:
                </span>
                <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[38px]">
                  {ccRecipients.map((user) => (
                    <span
                      key={user.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-charcoal-100 dark:bg-charcoal-800 text-charcoal-800 dark:text-charcoal-200 text-xs font-semibold rounded-lg border border-charcoal-200 dark:border-charcoal-700"
                    >
                      <span>{user.name}</span>
                      {user.department && (
                        <span className="text-[10px] text-charcoal-500 dark:text-charcoal-400 font-normal">
                          ({user.department.name})
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveCc(user.id)}
                        className="hover:text-rose-600 focus:outline-none"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={searchCcText}
                    onChange={(e) => {
                      setSearchCcText(e.target.value);
                      setIsCcDropdownOpen(true);
                    }}
                    onFocus={() => setIsCcDropdownOpen(true)}
                    placeholder={ccRecipients.length === 0 ? t('messages.selectCcRecipients') : ''}
                    className="flex-1 min-w-[140px] bg-transparent border-none outline-none text-xs sm:text-sm text-charcoal-900 dark:text-charcoal-100 placeholder:text-charcoal-400 py-1"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCc(false);
                    setCcRecipients([]);
                  }}
                  className="text-xs text-charcoal-400 hover:text-rose-500 pt-2 focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* CC Dropdown */}
              {isCcDropdownOpen && (
                <div className="absolute top-full start-12 end-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-charcoal-800 border border-charcoal-200 dark:border-charcoal-700 rounded-xl shadow-lg z-30 divide-y divide-charcoal-100 dark:divide-charcoal-700/50">
                  {loadingUsers ? (
                    <div className="p-3 text-center text-xs text-charcoal-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                      {t('common.loading')}
                    </div>
                  ) : filteredCcUsers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-charcoal-400">
                      {t('common.search')}
                    </div>
                  ) : (
                    filteredCcUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleSelectCc(user)}
                        className="w-full flex items-center justify-between p-2.5 hover:bg-brand-50/60 dark:hover:bg-brand-950/40 text-start transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-charcoal-100 dark:bg-charcoal-700 text-charcoal-600 dark:text-charcoal-300 flex items-center justify-center font-bold text-xs">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-charcoal-900 dark:text-charcoal-100">
                              {user.name}
                            </div>
                            <div className="text-[11px] text-charcoal-400">{user.email}</div>
                          </div>
                        </div>
                        {user.department && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-charcoal-100 dark:bg-charcoal-700 text-charcoal-600 dark:text-charcoal-300 font-medium">
                            {user.department.name}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Template Selector */}
          {templates.length > 0 && (
            <div className="relative border-b border-charcoal-100 dark:border-charcoal-800 pb-3" ref={templateMenuRef}>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-charcoal-500 dark:text-charcoal-400 min-w-[3rem] flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                </span>
                <button
                  type="button"
                  onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
                  className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 text-xs font-semibold hover:bg-brand-100 dark:hover:bg-brand-950/50 transition-colors"
                >
                  <span>{t('messages.selectTemplate')}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${templateMenuOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {templateMenuOpen && (
                <div className="absolute z-40 top-full start-12 end-0 mt-1 bg-white dark:bg-charcoal-800 border border-charcoal-200 dark:border-charcoal-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="w-full flex flex-col items-start px-4 py-3 text-xs hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors border-b border-charcoal-100 dark:border-charcoal-700/50 last:border-none"
                    >
                      <span className="font-bold text-charcoal-800 dark:text-charcoal-200">{tpl.name}</span>
                      {tpl.subject && (
                        <span className="text-[10px] text-charcoal-500 dark:text-charcoal-400 mt-0.5 truncate w-full">
                          {tpl.subject}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Subject Field */}
          <div className="border-b border-charcoal-100 dark:border-charcoal-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-charcoal-500 dark:text-charcoal-400 min-w-[3rem]">
                {t('messages.subject')}:
              </span>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={isRTL ? 'موضوع الرسالة...' : 'Message subject...'}
                className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm font-semibold text-charcoal-900 dark:text-charcoal-100 placeholder:text-charcoal-400 py-1"
              />
            </div>
          </div>

          {/* 4. Message Content Body */}
          <div className="flex-1 flex flex-col min-h-[200px]">
            <textarea
              required
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                isRTL
                  ? 'اكتب نص الرسالة هنا...'
                  : 'Write your message here...'
              }
              className="w-full flex-1 p-3.5 bg-charcoal-50/50 dark:bg-charcoal-800/40 border border-charcoal-200 dark:border-charcoal-700 rounded-xl outline-none text-xs sm:text-sm text-charcoal-900 dark:text-charcoal-100 placeholder:text-charcoal-400 resize-y focus:border-brand-500 dark:focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all leading-relaxed"
            />
          </div>

          {/* 5. Attachments Preview List */}
          {attachments.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-bold text-charcoal-700 dark:text-charcoal-300 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span>{t('messages.attachments')} ({attachments.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-white dark:bg-charcoal-800 border border-charcoal-200 dark:border-charcoal-700 rounded-xl shadow-xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      {getFileIcon(file.type, file.name)}
                      <div className="truncate">
                        <p className="text-xs font-semibold text-charcoal-800 dark:text-charcoal-200 truncate">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-charcoal-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="p-1 text-charcoal-400 hover:text-rose-600 rounded-lg hover:bg-charcoal-100 dark:hover:bg-charcoal-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* 6. Footer Actions: Attachments + Discard / Send */}
        <div className="px-6 py-4 bg-charcoal-50/80 dark:bg-charcoal-800/60 border-t border-charcoal-200 dark:border-charcoal-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-charcoal-700 dark:text-charcoal-300 bg-white dark:bg-charcoal-700 border border-charcoal-300 dark:border-charcoal-600 rounded-xl hover:bg-charcoal-50 dark:hover:bg-charcoal-600 transition-colors shadow-xs"
            >
              <Paperclip className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>{t('messages.attachFiles')}</span>
            </button>
            <span className="text-[11px] text-charcoal-400 hidden sm:inline">
              {t('messages.allowedFilesHint')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-charcoal-600 dark:text-charcoal-300 hover:bg-charcoal-200/60 dark:hover:bg-charcoal-700 rounded-xl transition-colors"
            >
              {t('messages.discard')}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 rounded-xl shadow-sm transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('messages.sending')}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{t('messages.send')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
