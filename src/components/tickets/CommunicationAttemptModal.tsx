'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/lib/i18n/context';
import { logCommunicationAttemptAction } from '@/server/actions/tickets';
import { AlertCircle } from 'lucide-react';

interface CommunicationAttemptModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  ticketNumber: string;
  onSuccess?: () => void;
}

export function CommunicationAttemptModal({
  isOpen,
  onClose,
  ticketId,
  ticketNumber,
  onSuccess,
}: CommunicationAttemptModalProps) {
  const [method, setMethod] = useState('PHONE');
  const [result, setResult] = useState('NO_ANSWER');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, language, getStatusLabel } = useI18n();

  const handleLogAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await logCommunicationAttemptAction({
      ticketId,
      method,
      result,
      note: note.trim() || null,
    });
    setLoading(false);

    if (res.success) {
      setNote('');
      onClose();
      if (onSuccess) onSuccess();
    } else {
      setError(res.error || t('common.error'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('tickets.logAttempt')} - ${ticketNumber}`}
      description={t('tickets.contactAttempts')}
    >
      <form onSubmit={handleLogAttempt} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('tickets.contactAttempts')}
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="PHONE">{getStatusLabel('PHONE')}</option>
              <option value="WHATSAPP">{getStatusLabel('WHATSAPP')}</option>
              <option value="EMAIL">{getStatusLabel('EMAIL')}</option>
              <option value="IN_PERSON">{getStatusLabel('IN_PERSON')}</option>
              <option value="OTHER">{getStatusLabel('OTHER')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('tickets.status')}
            </label>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="NO_ANSWER">{getStatusLabel('NO_ANSWER')}</option>
              <option value="INVALID_CONTACT">
                {language === 'ar' ? 'معلومات غير صحيحة' : 'Incorrect Information'}
              </option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('tickets.notes')}
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('tickets.notePlaceholder')}
            className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t('tickets.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('tickets.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
