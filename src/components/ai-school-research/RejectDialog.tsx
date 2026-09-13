'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/lib/i18n/context';

interface RejectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  loading?: boolean;
  candidateName?: string;
}

export function RejectDialog({ isOpen, onClose, onConfirm, loading, candidateName }: RejectDialogProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => onConfirm(reason)}
      title={t('aiResearch.reject')}
      description={candidateName || ''}
      confirmText={t('aiResearch.reject')}
      confirmVariant="danger"
      loading={loading}
    >
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('aiResearch.rejectReasonLabel')}
        rows={3}
        className="w-full mt-2 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:border-brand-500 focus:outline-none resize-none"
      />
    </ConfirmDialog>
  );
}
