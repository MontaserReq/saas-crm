'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { resetPasswordAction } from '@/server/actions/auth';
import { useI18n } from '@/lib/i18n/context';

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token') || ''), []);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(null); const result = await resetPasswordAction(token, password, confirm); if (result.success) { setDone(true); setTimeout(() => router.push('/login'), 1200); } else setError(result.error || t('auth.invalidResetLink')); };
  return <div className="min-h-screen bg-background dark:bg-slate-950 flex items-center justify-center p-4"><div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-6"><h1 className="text-2xl font-black text-slate-900 dark:text-white text-center">{t('auth.resetPassword')}</h1>{error && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs">{error}</div>}{done ? <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs">{t('auth.passwordResetSuccess')}</div> : <form onSubmit={submit} className="space-y-4"><label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('auth.newPassword')}<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" /></label><label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('auth.confirmPassword')}<input required minLength={8} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" /></label><button className="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-bold">{t('auth.resetPassword')}</button></form>}<Link href="/forgot-password" className="block text-center text-xs font-bold text-brand-600">{t('auth.requestNewResetLink')}</Link></div></div>;
}
