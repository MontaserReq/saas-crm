'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { resetPasswordAction, checkResetTokenAction } from '@/server/actions/auth';
import { useI18n } from '@/lib/i18n/context';
import { Loader2 } from 'lucide-react';

type LinkStatus = 'checking' | 'VALID' | 'EXPIRED' | 'ALREADY_USED' | 'INVALID';

// Errors handled as an inline message next to the still-usable form (client validation, or a
// transient server failure worth retrying). Token-state errors are handled separately below,
// via SUBMIT_ERROR_TO_LINK_STATUS, because they replace the form with a dedicated screen.
const INLINE_SUBMIT_ERROR_KEY: Record<string, string> = {
  PASSWORD_TOO_SHORT: 'settings.passwordLength',
  PASSWORD_MISMATCH: 'settings.passwordMismatch',
  RESET_FAILED: 'auth.resetFailed',
};

const LINK_STATUS_KEY: Record<string, string> = {
  EXPIRED: 'auth.expiredResetLink',
  ALREADY_USED: 'auth.alreadyUsedResetLink',
  INVALID: 'auth.invalidResetLink',
};

// Maps resetPasswordAction's submit-time error codes onto the same link-status values
// checkResetTokenAction reports, so a TOCTOU discovery at submit time can switch the page
// to the identical dedicated screen instead of just showing an inline error next to the form.
const SUBMIT_ERROR_TO_LINK_STATUS: Record<string, LinkStatus> = {
  INVALID_TOKEN: 'INVALID',
  TOKEN_EXPIRED: 'EXPIRED',
  TOKEN_ALREADY_USED: 'ALREADY_USED',
};

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [token, setToken] = useState('');
  const [linkStatus, setLinkStatus] = useState<LinkStatus>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const urlToken = new URLSearchParams(window.location.search).get('token') || '';
    setToken(urlToken);
    if (!urlToken) { setLinkStatus('INVALID'); return; }
    checkResetTokenAction(urlToken).then(setLinkStatus).catch(() => setLinkStatus('INVALID'));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) { setError(t('settings.passwordLength')); return; }
    if (password !== confirm) { setError(t('settings.passwordMismatch')); return; }
    setLoading(true);
    const result = await resetPasswordAction(token, password, confirm);
    setLoading(false);
    if (result.success) {
      setDone(true);
      setTimeout(() => router.replace('/login'), 1500);
      return;
    }
    // The token can change state between the initial check and submission (TOCTOU):
    // expired while filling the form, or consumed by a concurrent request. When the
    // server reports one of those definitive states, switch to the matching dedicated
    // screen instead of leaving a now-unusable form on display.
    if (result.error && SUBMIT_ERROR_TO_LINK_STATUS[result.error]) {
      setLinkStatus(SUBMIT_ERROR_TO_LINK_STATUS[result.error]);
      return;
    }
    setError(t(INLINE_SUBMIT_ERROR_KEY[result.error || 'RESET_FAILED'] || 'auth.resetFailed'));
  };

  return <div className="min-h-screen bg-background dark:bg-slate-950 flex items-center justify-center p-4"><div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-6"><h1 className="text-2xl font-black text-slate-900 dark:text-white text-center">{t('auth.resetPassword')}</h1>
    {linkStatus === 'checking' && !done ? (
      <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-brand-600" /></div>
    ) : linkStatus !== 'VALID' && !done ? (
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs">{t(LINK_STATUS_KEY[linkStatus] || 'auth.invalidResetLink')}</div>
        <Link href="/forgot-password" className="block text-center py-3 rounded-xl bg-brand-600 text-white text-sm font-bold">{t('auth.requestNewResetLink')}</Link>
      </div>
    ) : (
      <>
        {error && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs">{error}</div>}
        {done ? (
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('auth.passwordResetSuccess')}</div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('auth.newPassword')}<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" /></label>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('auth.confirmPassword')}<input required minLength={8} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" /></label>
            <button disabled={loading} className="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-bold disabled:opacity-50">{loading ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : t('auth.resetPassword')}</button>
          </form>
        )}
        {!done && <Link href="/forgot-password" className="block text-center text-xs font-bold text-brand-600">{t('auth.requestNewResetLink')}</Link>}
      </>
    )}
  </div></div>;
}
