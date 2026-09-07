'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/lib/i18n/context';
import { transferTicketAction } from '@/server/actions/tickets';
import { AlertCircle } from 'lucide-react';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  ticketNumber: string;
  teamMembers: Array<{ id: string; name: string; email: string; department?: { name: string } }>;
  onSuccess?: () => void;
}

export function TransferModal({
  isOpen,
  onClose,
  ticketId,
  ticketNumber,
  teamMembers,
  onSuccess,
}: TransferModalProps) {
  const [targetUserId, setTargetUserId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId) {
      setError(t('tickets.transferTo'));
      return;
    }
    if (reason.trim().length < 3) {
      setError(t('tickets.transferReason'));
      return;
    }

    setLoading(true);
    setError(null);

    const res = await transferTicketAction(ticketId, targetUserId, reason.trim());
    setLoading(false);

    if (res.success) {
      setReason('');
      setTargetUserId('');
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
      title={`${t('tickets.transfer')} - ${ticketNumber}`}
      description={t('tickets.transferReason')}
    >
      <form onSubmit={handleTransfer} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('tickets.transferTo')} <span className="text-rose-500">*</span>
          </label>
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            required
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">{t('tickets.transferTo')}...</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.department?.name || m.email})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t('tickets.transferReason')} <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('tickets.transferReason')}
            required
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
            {loading ? t('common.loading') : t('tickets.confirmTransfer')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
