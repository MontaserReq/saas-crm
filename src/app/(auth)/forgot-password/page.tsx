'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgotPasswordAction } from '@/server/actions/auth';
import { useI18n } from '@/lib/i18n/context';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); const result = await forgotPasswordAction(email); setMessage(result.message || t('auth.resetEmailSent')); setLoading(false); };
  return <div className="min-h-screen bg-background dark:bg-slate-950 flex items-center justify-center p-4"><div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-6"><div className="text-center"><div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-black text-xl">CL</div><h1 className="text-2xl font-black text-slate-900 dark:text-white">{t('auth.forgotPasswordTitle')}</h1><p className="text-xs text-slate-500 mt-2">{t('auth.forgotPasswordDescription')}</p></div>{message && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs">{message}</div>}<form onSubmit={submit} className="space-y-4"><label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('auth.email')}<div className="relative mt-1"><Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full ps-9 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" /></div></label><button disabled={loading} className="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-bold disabled:opacity-50">{loading ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : t('auth.sendResetLink')}</button></form><Link href="/login" className="flex items-center justify-center gap-2 text-xs font-bold text-brand-600"><ArrowLeft className="w-4 h-4 rtl:rotate-180" />{t('auth.signIn')}</Link></div></div>;
}
