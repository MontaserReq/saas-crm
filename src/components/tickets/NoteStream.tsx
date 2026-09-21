'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { addNoteAction } from '@/server/actions/tickets';
import { formatDate, formatFileSize } from '@/lib/utils';
import {
  Paperclip,
  Send,
  FileText,
  Download,
  ShieldAlert,
  Sparkles,
  Building2,
  ArrowRightLeft,
  User,
  Lock,
} from 'lucide-react';

interface NoteItem {
  id: string;
  content: string;
  priority?: string | null;
  transferToUserId?: string | null;
  createdAt: string | Date;
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
  attachments?: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    storageKey: string;
  }>;
}

interface DepartmentWithUsers {
  id: string;
  name: string;
  code: string;
  users: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

interface NoteStreamProps {
  ticketId: string;
  notes: NoteItem[];
  canAddNote?: boolean;
  ticketStatus?: string;
  isViewer?: boolean;
  departments?: DepartmentWithUsers[];
}

export function NoteStream({
  ticketId,
  notes,
  canAddNote = true,
  ticketStatus,
  isViewer = false,
  departments = [],
}: NoteStreamProps) {
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isTransferEnabled, setIsTransferEnabled] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, language } = useI18n();

  const isPending = ticketStatus === 'PENDING';
  const isLocked = !canAddNote || ticketStatus === 'CLOSED' || ticketStatus === 'REJECTED' || isViewer || isPending;

  // Find users in currently selected department
  const currentDeptUsers = departments.find((d) => d.id === selectedDepartmentId)?.users || [];

  const handleDepartmentChange = (deptId: string) => {
    setSelectedDepartmentId(deptId);
    const dept = departments.find((d) => d.id === deptId);
    if (dept && Array.isArray(dept.users) && dept.users.length > 0) {
      setSelectedUserId(dept.users[0].id);
    } else {
      setSelectedUserId('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    if (!content.trim()) return;

    if (isTransferEnabled && !selectedUserId) {
      setError(t('tickets.selectRecipientPrompt'));
      return;
    }

    // Require note content when transfer is enabled (belt-and-suspenders, server also checks)
    if (isTransferEnabled && !content.trim()) {
      setError(
        language === 'ar'
          ? 'يجب كتابة ملاحظة قبل تحويل التذكرة.'
          : 'Please add a note before transferring the ticket.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('ticketId', ticketId);
    formData.append('content', content.trim());

    if (isTransferEnabled && selectedUserId) {
      formData.append('transferToUserId', selectedUserId);
    }

    selectedFiles.forEach((file) => {
      formData.append('attachments', file);
    });

    const res = await addNoteAction(formData);
    setLoading(false);

    if (res.success) {
      setContent('');
      setSelectedFiles([]);
      setIsTransferEnabled(false);
      setSelectedDepartmentId('');
      setSelectedUserId('');
    } else {
      setError(res.error || t('common.error'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Notice on Immutability */}
      <div className="flex items-center gap-2 p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>{t('tickets.immutableNotice')}</span>
      </div>

      {/* Existing Notes Stream */}
      <div className="space-y-4">
        {notes.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <Sparkles className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('tickets.noNotesYet')}</p>
          </div>
        ) : (
          notes.map((note, index) => (
            <div
              key={note.id}
              className="bg-amber-50/50 dark:bg-slate-800/80 border border-amber-200/60 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm hover:shadow transition-all relative overflow-hidden"
            >
              {/* Note Header */}
              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-amber-200/40 dark:border-slate-700/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                    {note.author.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">
                      {note.author.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{formatDate(note.createdAt, language)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {note.transferToUserId && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-brand-700 dark:text-brand-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>{t('tickets.handoverTransfer')}</span>
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/60 dark:bg-slate-700 text-amber-900 dark:text-slate-300">
                    {t('tickets.noteNumber')} {index + 1}
                  </span>
                </div>
              </div>

              {/* Note Content */}
              <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                {note.content}
              </p>

              {/* Attachments inside Note */}
              {note.attachments && note.attachments.length > 0 && (
                <div className="mt-4 pt-3 border-t border-amber-200/40 dark:border-slate-700/40 space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                    {t('tickets.attachedFiles')}:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {note.attachments.map((att) => (
                      <a
                        key={att.id}
                        href={`/api/attachments/${att.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-brand-500 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-sm transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-brand-600" />
                        <span className="max-w-[140px] truncate">{att.originalName}</span>
                        <span className="text-[10px] text-slate-400">({formatFileSize(att.size)})</span>
                        <Download className="w-3 h-3 text-slate-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* View-Only / Locked Banner if applicable */}
      {isLocked ? (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs">
          <Lock className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            {ticketStatus === 'PENDING'
              ? (language === 'ar'
                  ? 'يجب قبول التذكرة أولًا قبل إضافة أي ملاحظة.'
                  : 'Please accept the ticket before adding a note.')
              : ticketStatus === 'CLOSED'
              ? t('tickets.ticketClosedNotice')
              : ticketStatus === 'REJECTED'
              ? t('tickets.ticketRejectedNotice')
              : t('tickets.viewOnlyNotice')}
          </span>
        </div>
      ) : (
        /* Add New Immutable Note Form */
        <form
          onSubmit={handlePostNote}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4"
        >
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('tickets.addNote')}</span>
            <span className="text-[10px] text-slate-400">{t('tickets.markdownSupported')}</span>
          </div>

          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('tickets.notePlaceholder')}
            required
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 text-sm focus:bg-white dark:focus:bg-slate-900 focus:border-brand-500 focus:outline-none transition-all"
          />

          {/* Optional Transfer Note Toggle */}
          {departments.length > 0 && (
            <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/50 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isTransferEnabled}
                    onChange={(e) => {
                      setIsTransferEnabled(e.target.checked);
                      if (e.target.checked && departments.length > 0) {
                        handleDepartmentChange(departments[0].id);
                      }
                    }}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-xs font-bold text-brand-800 dark:text-brand-300 flex items-center gap-1">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-brand-600" />
                    <span>{t('tickets.postNoteAndTransfer')}</span>
                  </span>
                </label>
              </div>

              {isTransferEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-purple-200/50 dark:border-purple-800/40">
                  {/* Step 1: Select Department */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-brand-600" />
                      <span>{t('tickets.selectDepartmentPrompt')}</span>
                    </label>
                    <select
                      value={selectedDepartmentId}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                      required={isTransferEnabled}
                      className="w-full p-2 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Step 2: Select Recipient Member */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-brand-600" />
                      <span>{t('tickets.selectRecipientPrompt')}</span>
                    </label>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      required={isTransferEnabled}
                      disabled={currentDeptUsers.length === 0}
                      className="w-full p-2 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                    >
                      {currentDeptUsers.length === 0 ? (
                        <option value="">{t('tickets.noActiveMembersInDept')}</option>
                      ) : (
                        currentDeptUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attachments preview list */}
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {selectedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  <FileText className="w-3.5 h-3.5 text-brand-600" />
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-rose-500 font-bold ml-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
              <Paperclip className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('tickets.uploadFile')}</span>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*"
              />
            </label>

            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-all shadow-md shadow-brand-500/10"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {loading
                  ? t('common.loading')
                  : isTransferEnabled
                  ? t('tickets.postNoteAndTransfer')
                  : t('tickets.addNote')}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
