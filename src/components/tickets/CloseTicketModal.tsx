'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { closeTicketAction } from '@/server/actions/tickets';
import { useI18n } from '@/lib/i18n/context';
import { Archive, AlertCircle } from 'lucide-react';

interface CloseTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  ticketNumber: string;
  onSuccess?: () => void;
}

export function CloseTicketModal({
  isOpen,
  onClose,
  ticketId,
  ticketNumber,
  onSuccess,
}: CloseTicketModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, language } = useI18n();

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 3) {
      setError(t('tickets.closingReasonMinError'));
      return;
    }

    setLoading(true);
    setError(null);

    const res = await closeTicketAction(ticketId, reason.trim());
    setLoading(false);

    if (res.success) {
      setReason('');
      onClose();
      if (onSuccess) onSuccess();
    } else {
      setError(res.error || t('common.error'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!loading) {
          setReason('');
          setError(null);
          onClose();
        }
      }}
      title={`${t('tickets.closeTicket')} - ${ticketNumber}`}
      description={t('tickets.closeConfirmDesc')}
    >
      <form onSubmit={handleClose} className="space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('tickets.closingReason')} <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('tickets.closingReasonPlaceholderDesc')}
            required
            autoFocus
            className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:border-brand-500 focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading || !reason.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-white bg-slate-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 transition-all shadow-md disabled:opacity-50"
          >
            <Archive className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {loading ? t('common.loading') : t('tickets.confirmCloseAction')}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
