'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { verifyAdminPasswordAction } from '@/server/actions/admin';
import { useI18n } from '@/lib/i18n/context';
import { ShieldAlert, Lock, AlertCircle, Trash2 } from 'lucide-react';

interface AdminPasswordConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  itemDescription?: string;
  onConfirm: () => Promise<void> | void;
}

export function AdminPasswordConfirmModal({
  isOpen,
  onClose,
  title,
  itemDescription,
  onConfirm,
}: AdminPasswordConfirmModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, language } = useI18n();

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError(t('admin.passwordConfirm.requiredError'));
      return;
    }

    setLoading(true);
    setError(null);

    const verification = await verifyAdminPasswordAction(password);
    if (!verification.success) {
      setLoading(false);
      setError(verification.error || t('admin.passwordConfirm.invalidPassword'));
      return;
    }

    try {
      await onConfirm();
      setPassword('');
      onClose();
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!loading) {
          setPassword('');
          setError(null);
          onClose();
        }
      }}
      title={title || t('admin.passwordConfirm.defaultTitle')}
      description={t('admin.passwordConfirm.desc')}
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        {/* Warning Banner */}
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
          <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">
              {t('admin.passwordConfirm.securityNotice')}
            </span>
            <p className="leading-relaxed">
              {itemDescription || t('admin.passwordConfirm.defaultItemDesc')}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('admin.passwordConfirm.enterPasswordPrompt')}</span>
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
            className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-rose-500 focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading || !password}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-md shadow-rose-600/20 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {loading ? t('common.loading') : t('admin.passwordConfirm.confirmPermanentDeletion')}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
