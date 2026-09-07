'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { transferUserWorkAction } from '@/server/actions/users';
import { useI18n } from '@/lib/i18n/context';
import { ArrowRightLeft, AlertCircle, CheckCircle2, UserX } from 'lucide-react';

interface OffboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  allUsers: Array<{
    id: string;
    name: string;
    email: string;
    department?: { name: string } | null;
  }>;
}

export function OffboardingModal({
  isOpen,
  onClose,
  user,
  allUsers,
}: OffboardingModalProps) {
  const { t, language } = useI18n();
  const [toUserId, setToUserId] = useState('');
  const [transferTickets, setTransferTickets] = useState(true);
  const [transferSchools, setTransferSchools] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    tickets: number;
    schools: number;
  } | null>(null);

  if (!user) return null;

  const candidateUsers = allUsers.filter((u) => u.id !== user.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toUserId) {
      setError(t('admin.users.offboarding.selectEmployee'));
      return;
    }

    setLoading(true);
    setError(null);

    const res = await transferUserWorkAction({
      fromUserId: user.id,
      toUserId,
      transferOpenTickets: transferTickets,
      transferResponsibleSchools: transferSchools,
    });

    setLoading(false);

    if (res.success) {
      setResult({
        tickets: res.transferredTicketsCount || 0,
        schools: res.transferredSchoolsCount || 0,
      });
    } else {
      setError(res.error || t('common.error'));
    }
  };

  const handleClose = () => {
    setToUserId('');
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`${t('admin.users.offboarding.title')}: ${user.name}`}
      description={t('admin.users.offboarding.description')}
    >
      {result ? (
        <div className="space-y-4 py-3">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-emerald-900 dark:text-emerald-200">
                {t('admin.users.offboarding.success')}
              </p>
              <p className="text-emerald-700 dark:text-emerald-300">
                {t('admin.users.offboarding.transferredSummary', {
                  tickets: result.tickets,
                  schools: result.schools,
                })}
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={handleClose}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* User Being Offboarded Banner */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
            <UserX className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold block">{user.name}</span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400">{user.email}</span>
            </div>
          </div>

          {/* Destination User */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-brand-500" />
              <span>{t('admin.users.offboarding.transferTo')} *</span>
            </label>
            <select
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              required
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:border-brand-500 focus:outline-none transition-all"
            >
              <option value="">
                {t('admin.users.offboarding.selectEmployee')}
              </option>
              {candidateUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.department ? `(${u.department.name})` : ''} - {u.email}
                </option>
              ))}
            </select>
          </div>

          {/* Options */}
          <div className="space-y-2.5 pt-1">
            <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={transferTickets}
                onChange={(e) => setTransferTickets(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="font-medium">
                {t('admin.users.offboarding.transferTickets')}
              </span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={transferSchools}
                onChange={(e) => setTransferSchools(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="font-medium">
                {t('admin.users.offboarding.transferSchools')}
              </span>
            </label>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !toUserId}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-all shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>{loading ? t('common.loading') : t('admin.users.offboarding.confirmTransfer')}</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
