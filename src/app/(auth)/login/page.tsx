'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { loginAction } from '@/server/actions/auth';
import { useI18n } from '@/lib/i18n/context';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { BrandLogo } from '@/components/brand/BrandLogo';

export default function LoginPage() {
  const { t, language } = useI18n();
  const ar = language === 'ar';
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => setExpired(new URLSearchParams(window.location.search).get('expired') === '1'), []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const result = await loginAction({ email, password });
    setLoading(false);
    if (!result.success) {
      setError(result.error || t('auth.invalidCredentials'));
      return;
    }
    const pending = localStorage.getItem('codeline_pending_email_connect');
    if (new URLSearchParams(window.location.search).get('connect') === '1' && pending) {
      try {
        const data = JSON.parse(pending) as { provider: string; scopes: string[] };
        localStorage.removeItem('codeline_pending_email_connect');
        if (data.provider === 'google' || data.provider === 'microsoft') {
          window.location.assign(`/api/integrations/oauth/start?provider=${encodeURIComponent(data.provider)}&scopes=${encodeURIComponent(data.scopes.join(','))}`);
          return;
        }
        router.push('/settings?integration=smtp-setup');
        router.refresh();
        return;
      } catch {
        localStorage.removeItem('codeline_pending_email_connect');
      }
    }
    router.push(result.role === 'PLATFORM_ADMIN' ? '/admin' : '/dashboard');
    router.refresh();
  };

  const points = ar
    ? ['سياق العميل والعمل في مكان واحد', 'وصول منضبط حسب الدور والمؤسسة', 'واجهة عربية وإنجليزية متكاملة']
    : ['Customer context and daily work together', 'Role- and organization-aware access', 'Complete Arabic and English experience'];

  return <main className="min-h-screen bg-[#F7F5FA] text-[#24152F] dark:bg-[#160D1E] dark:text-[#F7F5FA]" dir={ar ? 'rtl' : 'ltr'}>
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-8 sm:py-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center" aria-label="SatrCRM home">
          <BrandLogo className="h-9 w-[142px]" priority />
        </Link>
        <div className="flex items-center gap-2"><LanguageSwitcher /><ThemeToggle /></div>
      </header>

      <div className="my-auto grid items-stretch gap-6 py-8 lg:grid-cols-[1.05fr_.95fr] lg:py-12">
        <section className="relative hidden overflow-hidden rounded-[2rem] bg-[#24152F] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14" aria-labelledby="login-value-title">
          <div className="absolute -end-20 -top-24 h-72 w-72 rounded-full border border-[#D4B16A]/25" aria-hidden="true" />
          <div className="absolute -end-8 -top-10 h-40 w-40 rounded-full border border-white/10" aria-hidden="true" />
          <div className="relative">
            <BrandLogo tone="white" className="h-8 w-[127px]" />
            <h1 id="login-value-title" className="mt-7 max-w-xl text-4xl font-bold leading-tight xl:text-5xl">{ar ? 'عد إلى مساحة تجمع علاقاتك وعمل فريقك.' : 'Return to the workspace where relationships become progress.'}</h1>
            <p className="mt-5 max-w-xl leading-8 text-white/70">{ar ? 'تابع العملاء والصفقات والمهام من سياق واحد واضح، دون أن تفقد الخطوة التالية.' : 'Keep customers, opportunities, and team follow-up in one clear context — with every next step in view.'}</p>
          </div>
          <ul className="relative mt-12 grid gap-4 text-sm text-white/85">{points.map(point => <li key={point} className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#D4B16A]/15 text-[#D4B16A]"><Check className="h-4 w-4" /></span>{point}</li>)}</ul>
        </section>

        <section className="flex items-center rounded-[2rem] border border-[#DDD6E3] bg-white p-5 shadow-[0_24px_70px_rgba(36,21,47,.08)] dark:border-[#473653] dark:bg-[#24152F] sm:p-9 xl:p-12" aria-labelledby="login-title">
          <div className="mx-auto w-full max-w-md">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#482080] dark:text-[#D4B16A]">{ar ? 'أهلاً بعودتك' : 'Welcome back'}</p>
            <h2 id="login-title" className="mt-3 text-3xl font-black">{t('auth.loginTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">{t('auth.loginSubtitle')}</p>

            {(expired || error) && <div className="mt-6 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error || t('auth.sessionExpired')}</span></div>}

            <form onSubmit={submit} className="mt-7 space-y-5">
              <label className="block text-sm font-bold" htmlFor="login-email">{t('auth.email')}</label>
              <div className="relative -mt-3"><Mail className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="login-email" required type="email" autoComplete="email" dir="ltr" value={email} onChange={event => setEmail(event.target.value)} placeholder={t('auth.emailPlaceholder')} className="w-full rounded-xl border border-slate-300 bg-white py-3 pe-4 ps-10 text-sm outline-none transition focus:border-[#482080] focus:ring-4 focus:ring-[#482080]/10 dark:border-slate-600 dark:bg-[#1C1026]" /></div>
              <div className="flex items-center justify-between gap-4"><label className="text-sm font-bold" htmlFor="login-password">{t('auth.password')}</label><Link href="/forgot-password" className="text-xs font-bold text-[#482080] underline-offset-4 hover:underline dark:text-[#D4B16A]">{t('auth.forgotPassword')}</Link></div>
              <div className="relative -mt-3"><Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="login-password" required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder={t('auth.passwordPlaceholder')} className="w-full rounded-xl border border-slate-300 bg-white py-3 pe-11 ps-10 text-sm outline-none transition focus:border-[#482080] focus:ring-4 focus:ring-[#482080]/10 dark:border-slate-600 dark:bg-[#1C1026]" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute end-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#482080] dark:hover:bg-white/10" aria-label={showPassword ? (ar ? 'إخفاء كلمة المرور' : 'Hide password') : (ar ? 'إظهار كلمة المرور' : 'Show password')}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
              <button disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#482080] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#351761] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#482080] disabled:opacity-50">{loading ? t('auth.signingIn') : t('auth.signIn')}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></button>
            </form>
            <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-300">{ar ? 'جديد في CodeLine؟' : 'New to CodeLine?'} <Link href="/onboarding" className="font-bold text-[#482080] underline-offset-4 hover:underline dark:text-[#D4B16A]">{ar ? 'ابدأ تجربتك المجانية لمدة 7 أيام' : 'Start your free 7-day trial'}</Link></p>
          </div>
        </section>
      </div>
      <footer className="text-center text-xs text-slate-600 dark:text-slate-400">{t('app.copyright')}</footer>
    </div>
  </main>;
}
