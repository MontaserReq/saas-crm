'use client';

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Eye, EyeOff, Languages, Loader2, LockKeyhole, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { beginSignupAction, registerOrganizationAction } from '@/server/actions/auth';
import { completeOnboardingAction, onboardingEventAction, saveOnboardingAction } from '@/server/actions/onboarding';
import { answersSchema, goalIds, goalLabels, industries, selectedGoals, type SetupAnswers, type SetupState } from '@/lib/onboarding/templates';

import { SetupRecommendation } from './SetupRecommendation';

const control = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
const primary = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-purple-700 px-6 py-3 font-bold text-white hover:bg-purple-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-600 disabled:opacity-60';

const passwordRules = [
  { key: 'length', test: (value: string) => value.length >= 8, en: 'At least 8 characters', ar: '8 أحرف على الأقل' },
  { key: 'lowercase', test: (value: string) => /[a-z]/.test(value), en: 'One lowercase letter', ar: 'حرف إنجليزي صغير واحد' },
  { key: 'uppercase', test: (value: string) => /[A-Z]/.test(value), en: 'One uppercase letter', ar: 'حرف إنجليزي كبير واحد' },
  { key: 'number', test: (value: string) => /\d/.test(value), en: 'One number', ar: 'رقم واحد' },
  { key: 'special', test: (value: string) => /[^A-Za-z0-9\s]/.test(value), en: 'One special character', ar: 'رمز خاص واحد مثل ! أو @' },
] as const;

export default function OnboardingFlow({ initialState = null }: { initialState?: SetupState | null }) {
  const { language, setLanguage } = useI18n();
  const ar = language === 'ar';
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [answers, setAnswers] = useState<SetupAnswers>(initialState?.answers ?? answersSchema.parse({ workspace: 'My workspace' }));
  const [standard, setStandard] = useState(initialState?.standard ?? false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [account, setAccount] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(true);
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const resumeLogged = useRef(false);
  const signupLogged = useRef(false);
  const draftVersion = useRef(0);
  const step = state?.step ?? 0;
  const text = (en: string, arabic: string) => ar ? arabic : en;
  const title = step === 0 ? text('Start with a simple account', 'ابدأ بحساب بسيط') : step === 1 ? text('Tell us about your business', 'أخبرنا عن عملك') : step === 2 ? text('What would help your team?', 'ما الذي يساعد فريقك؟') : step === 3 ? text('Your recommended workspace', 'مساحة العمل المقترحة لك') : text('Ready to make it yours?', 'هل أنت جاهز للبدء؟');
  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.current.then(work, work);
    queue.current = next.catch(() => undefined);
    return next;
  }
  function message(code?: string) {
    if (code === 'SETUP_INVALID') return text('Check your selections and use distinct, nonempty pipeline names.', 'تحقق من اختياراتك واستخدم أسماء مراحل مختلفة وغير فارغة.');
    if (code === 'SIGNUP_INVALID') return text('Check your account details and password, then try again.', 'تحقق من بيانات الحساب وكلمة المرور وحاول مجدداً.');
    if (code === 'SIGNUP_RETRY') return text('We could not create the account right now. Please try again in a moment.', 'تعذر إنشاء الحساب الآن. حاول مرة أخرى بعد قليل.');
    if (code === 'SIGNUP_DISABLED') return text('New registrations are currently closed. Please contact support.', 'التسجيلات الجديدة مغلقة حاليًا. يرجى التواصل مع الدعم.');
    if (code === 'SIGNUP_PLAN_UNAVAILABLE') return text('New workspace registration is temporarily unavailable. Please contact support.', 'تسجيل مساحات العمل الجديدة غير متاح مؤقتًا. يرجى التواصل مع الدعم.');
    if (code === 'SIGNUP_EXISTS') return text('This email already has an account. Sign in to continue.', 'يوجد حساب بهذا البريد. سجل الدخول للمتابعة.');
    if (code === 'FORBIDDEN') return text('Your account cannot change this setup. Ask your workspace administrator.', 'حسابك لا يملك صلاحية تغيير الإعداد. تواصل مع مسؤول المؤسسة.');
    return text('We could not save your setup. Your saved progress is safe. Check your connection and try again.', 'تعذر حفظ الإعداد. تقدمك المحفوظ آمن. تحقق من الاتصال وحاول مجدداً.');
  }
  useEffect(() => { if (!initialState && !signupLogged.current) { signupLogged.current = true; void beginSignupAction(); } }, [initialState]);
  useEffect(() => {
    if (initialState && !resumeLogged.current) {
      resumeLogged.current = true; void onboardingEventAction('ONBOARDING_RESUMED');
    }
  }, [initialState]);
  useEffect(() => {
    if (!state) return;
    const abandon = () => { void onboardingEventAction('ONBOARDING_ABANDONED'); };
    window.addEventListener('pagehide', abandon);
    return () => window.removeEventListener('pagehide', abandon);
  }, [state]);
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function update(patch: Partial<SetupAnswers>, useStandard = standard) {
    const version = ++draftVersion.current;
    const next = { ...answers, ...patch, language };
    setAnswers(next); setStandard(useStandard); setError(''); setInvalid({}); setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    if (!state || !answersSchema.safeParse(next).success) { setSaved(false); return; }
    timer.current = setTimeout(() => {
      void enqueue(async () => {
        try {
          const result = await saveOnboardingAction({ answers: next, step, standard: useStandard });
          if (version === draftVersion.current) setSaved(result.success);
          if (!result.success) setError(message(result.error));
        } catch { setError(message()); }
      });
    }, 650);
  }

  async function submit(event: React.FormEvent, skipped = false) {
    event.preventDefault(); if (busy) return;
    setError(''); setInvalid({});
    if (timer.current) clearTimeout(timer.current);
    if (state && !answersSchema.safeParse(answers).success) {
      if (!answersSchema.shape.workspace.safeParse(answers.workspace).success) setInvalid({ workspace: text('Enter a company name with 2–120 characters.', 'أدخل اسم الشركة من حرفين إلى 120 حرفاً.') });
      else setError(message('SETUP_INVALID')); return;
    }
    if (!state && account.password !== account.confirmPassword) {
      setInvalid({ confirmPassword: text('The passwords do not match.', 'كلمتا المرور غير متطابقتين.') }); return;
    }
    if (!state && passwordRules.some(rule => !rule.test(account.password))) {
      setInvalid({ password: text('Use at least 8 characters with uppercase, lowercase, a number, and a special character.', 'استخدم 8 أحرف على الأقل مع حرف كبير وحرف صغير ورقم ورمز خاص.') }); return;
    }
    setBusy(true);
    try {
      if (!state) {
        const result = await registerOrganizationAction({ ...account, workspace: text('My workspace', 'مساحة عملي'), language });
        if (!result.success || !result.state) { setError(message(result.error)); return; }
        setAccount({ name: '', email: '', password: '', confirmPassword: '' });
        setState(result.state); setAnswers(result.state.answers); setSaved(true);
      } else {
        const nextAnswers = skipped ? { ...answers, priority: 'sales' as const, goals: ['customers', 'leads', 'pipelines', 'tasks'] as SetupAnswers['goals'], tracking: 'none' as const, modules: undefined, pipelineStages: undefined, language } : { ...answers, language };
        const result = await enqueue(() => saveOnboardingAction({ answers: nextAnswers, step: Math.min(4, step + 1), skipped, standard }));
        if (!result.success) { setError(message(result.error)); return; }
        setState(result.state); setAnswers(result.state.answers); setSaved(true);
        if (step === 4) {
          const completed = await enqueue(() => completeOnboardingAction({ standard }));
          if (!completed.success) { setError(message(completed.error)); return; }
          router.push('/dashboard'); router.refresh();
        }
      }
    } catch { setError(message()); } finally { setBusy(false); }
  }
  async function back() {
    if (busy || step < 2) return;
    if (timer.current) clearTimeout(timer.current);
    setBusy(true);
    try {
      const result = await enqueue(() => saveOnboardingAction({ answers: answersSchema.safeParse(answers).success ? { ...answers, language } : state!.answers, step: step - 1, standard }));
      if (result.success) { setState(result.state); setSaved(answersSchema.safeParse(answers).success); } else setError(message(result.error));
    } catch { setError(message()); } finally { setBusy(false); }
  }
  function choices<T extends string>(label: string, value: T, items: Array<[T, string, string]>, select: (value: T) => void) {
    return <fieldset className="space-y-3"><legend className="font-bold">{label}</legend><div className="grid gap-3 sm:grid-cols-2">{items.map(([id, name, description]) => <label key={id} className={`relative flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-start transition-colors ${value === id ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/50' : 'border-slate-300 hover:border-purple-400 dark:border-slate-600'}`}><input type="radio" name={label} value={id} checked={value === id} onChange={() => select(id)} className="mt-1 h-4 w-4 shrink-0 accent-purple-700" /><span><span className="block font-bold">{name}</span>{description && <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</span>}</span></label>)}</div></fieldset>;
  }

  return <main dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-[#f8f6fa] text-slate-950 dark:bg-slate-950 dark:text-white">
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5"><Link href="/" className="flex items-center" aria-label="SatrCRM home"><BrandLogo className="h-9 w-[142px]" priority /></Link><div className="flex items-center gap-2"><button type="button" disabled={busy} onClick={() => setLanguage(ar ? 'en' : 'ar')} className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"><Languages className="h-4 w-4" />{ar ? 'English' : 'العربية'}</button><ThemeToggle /></div></header>
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[.8fr_1.2fr] lg:py-16">
      <aside><p className="mb-5 flex items-center gap-2 text-sm font-bold text-purple-700 dark:text-purple-300"><Sparkles className="h-4 w-4" />{text('Smart Setup', 'البداية الذكية')}</p><h1 ref={heading} tabIndex={-1} className="focus:outline-none text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1><p className="mt-4 max-w-md leading-7 text-slate-600 dark:text-slate-300">{text('A few simple answers. A workspace organized around your business. You can change everything later.', 'إجابات بسيطة ومساحة عمل تناسب نشاطك. يمكنك تعديل الإعدادات لاحقاً.')}</p><p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{text('Designed for a short setup. No technical experience needed.', 'إعداد قصير دون الحاجة لخبرة تقنية.')}</p>
        {state && <ol aria-label={text('Setup progress', 'تقدم الإعداد')} className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-1">{[text('Your business', 'نشاطك'), text('Goals and team', 'الأهداف والفريق'), text('Recommended setup', 'الإعداد المقترح'), text('Create workspace', 'إنشاء المساحة')].map((name, i) => <li key={name} aria-current={step === i + 1 ? 'step' : undefined} className={`flex items-center gap-3 text-sm ${step === i + 1 ? 'font-bold text-purple-700 dark:text-purple-300' : 'text-slate-600 dark:text-slate-300'}`}><span className={`flex h-8 w-8 items-center justify-center rounded-full ${step >= i + 1 ? 'bg-purple-700 text-white' : 'border border-slate-300 dark:border-slate-600'}`}>{step > i + 1 ? <Check className="h-4 w-4" /> : i + 1}</span>{name}</li>)}</ol>}
        <p className="mt-8 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><LockKeyhole className="h-4 w-4 shrink-0" />{text('Your workspace belongs to your organization.', 'مساحة عمل آمنة خاصة بمؤسستك.')}</p>
      </aside>
      <form onSubmit={submit} aria-busy={busy} className="min-w-0 space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-purple-950/5 dark:border-slate-700 dark:bg-slate-900 sm:p-8">
        <div className="flex items-center justify-between gap-3"><h2 className="font-bold">{step === 0 ? text('Create your account', 'أنشئ حسابك') : text(`Step ${step} of 4`, `الخطوة ${step} من 4`)}</h2>{state && <span role="status" className="text-xs text-slate-600 dark:text-slate-300">{saved ? text('Progress saved', 'تم حفظ التقدم') : text('Changes not saved yet', 'التغييرات لم تُحفظ بعد')}</span>}</div>
        <fieldset disabled={busy} className="space-y-6">
          {step === 0 && <div className="space-y-4">
            <label className="block text-sm font-semibold">{text('Your name', 'اسمك')}<input required name="name" type="text" autoComplete="name" minLength={2} maxLength={120} value={account.name} onChange={e => setAccount({ ...account, name: e.target.value })} aria-invalid={!!invalid.name} aria-describedby={invalid.name ? 'name-error' : undefined} className={control} />{invalid.name && <span id="name-error" className="mt-2 block text-sm text-red-700 dark:text-red-300">{invalid.name}</span>}</label>
            <label className="block text-sm font-semibold">{text('Email address', 'البريد الإلكتروني')}<input required name="email" type="email" autoComplete="email" dir="ltr" maxLength={254} value={account.email} onChange={e => setAccount({ ...account, email: e.target.value })} aria-invalid={!!invalid.email} aria-describedby={invalid.email ? 'email-error' : undefined} className={control} />{invalid.email && <span id="email-error" className="mt-2 block text-sm text-red-700 dark:text-red-300">{invalid.email}</span>}</label>
            <label className="block text-sm font-semibold">{text('Password', 'كلمة المرور')}
              <span className="relative block"><input required name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" dir="ltr" minLength={8} maxLength={256} value={account.password} onChange={e => setAccount({ ...account, password: e.target.value })} aria-invalid={!!invalid.password} aria-describedby="password-rules password-error" className={`${control} pe-12`} /><button type="button" onClick={() => setShowPassword(value => !value)} className="absolute end-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-600 dark:hover:bg-white/10" aria-label={showPassword ? text('Hide password', 'إخفاء كلمة المرور') : text('Show password', 'إظهار كلمة المرور')}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
              <span id="password-rules" className="mt-2 grid gap-1 text-xs font-normal text-slate-500 dark:text-slate-400">{passwordRules.map(rule => <span key={rule.key} className={rule.test(account.password) ? 'text-emerald-700 dark:text-emerald-300' : ''}><Check className="me-1 inline h-3 w-3" aria-hidden="true" />{text(rule.en, rule.ar)}</span>)}</span>
              {invalid.password && <span id="password-error" className="mt-2 block text-sm text-red-700 dark:text-red-300">{invalid.password}</span>}
            </label>
            <label className="block text-sm font-semibold">{text('Confirm password', 'تأكيد كلمة المرور')}
              <span className="relative block"><input required name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" dir="ltr" minLength={8} maxLength={256} value={account.confirmPassword} onChange={e => setAccount({ ...account, confirmPassword: e.target.value })} aria-invalid={!!invalid.confirmPassword} aria-describedby={invalid.confirmPassword ? 'confirmPassword-error' : undefined} className={`${control} pe-12`} /><button type="button" onClick={() => setShowConfirmPassword(value => !value)} className="absolute end-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-600 dark:hover:bg-white/10" aria-label={showConfirmPassword ? text('Hide password', 'إخفاء كلمة المرور') : text('Show password', 'إظهار كلمة المرور')}>{showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
              {invalid.confirmPassword && <span id="confirmPassword-error" className="mt-2 block text-sm text-red-700 dark:text-red-300">{invalid.confirmPassword}</span>}
            </label>
            <p className="rounded-xl border border-purple-100 bg-purple-50 p-3 text-sm text-purple-950 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-100">{text('Your workspace starts with a free seven-day Starter trial. No payment or email integration is needed to begin.', 'تبدأ مساحة عملك بتجربة Starter مجانية لمدة سبعة أيام. لا تحتاج إلى دفع أو ربط البريد للبدء.')}</p>
          </div>}
          {step === 1 && <><label className="block text-sm font-semibold">{text('Company or team name', 'اسم الشركة أو الفريق')}<input name="workspace" required minLength={2} maxLength={120} value={answers.workspace} onChange={e => update({ workspace: e.target.value })} aria-invalid={!!invalid.workspace} aria-describedby={invalid.workspace ? 'workspace-error' : undefined} className={control} />{invalid.workspace && <span id="workspace-error" className="mt-2 block text-sm text-red-700 dark:text-red-300">{invalid.workspace}</span>}</label>{choices(text('What kind of business?', 'ما نوع نشاطك؟'), answers.industry, Object.entries(industries).map(([id, item]) => [id as SetupAnswers['industry'], item.title[language], '']), industry => update({ industry, modules: undefined, pipelineStages: undefined }))}<label className="block text-sm font-semibold">{text('About your business (optional)', 'نبذة عن نشاطك (اختياري)')}<textarea name="description" rows={2} maxLength={500} value={answers.description} onChange={event => update({ description: event.target.value })} className={control} /><span className="mt-2 block text-xs font-normal text-slate-500 dark:text-slate-400">{text('Saved as workspace context. Your selections determine the setup.', 'تُحفظ كنبذة عن المساحة. اختياراتك تحدد الإعداد.')}</span></label></>}
          {step === 2 && <><fieldset className="space-y-3"><legend className="font-bold">{text('What do you want to manage? Choose any.', 'ماذا تريد أن تدير؟ اختر ما يناسبك.')}</legend><div className="grid gap-3 sm:grid-cols-2">{goalIds.map(id => <label key={id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${selectedGoals(answers).includes(id) ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/50' : 'border-slate-300 dark:border-slate-600'}`}><input type="checkbox" name="goals" value={id} checked={selectedGoals(answers).includes(id)} onChange={event => { const goals = event.target.checked ? [...selectedGoals(answers), id] : selectedGoals(answers).filter(goal => goal !== id); update({ goals: goals.length ? goals : ['customers'], priority: goals.includes('leads') || goals.includes('pipelines') ? 'sales' : goals.includes('support') || goals.includes('tasks') ? 'delivery' : 'relationships', modules: undefined, pipelineStages: undefined }); }} className="h-4 w-4 shrink-0 accent-purple-700" /><span className="text-sm font-bold">{goalLabels[id][language]}</span></label>)}</div></fieldset><label className="block text-sm font-semibold">{text('Team size', 'حجم الفريق')}<select value={answers.teamSize} onChange={e => update({ teamSize: e.target.value as SetupAnswers['teamSize'] })} className={control}>{['1', '2-5', '6-15', '16+'].map(size => <option key={size} value={size}>{size === '1' ? text('Just me', 'أنا فقط') : size}</option>)}</select><span className="mt-2 block text-xs font-normal text-slate-500 dark:text-slate-400">{text('Helps us suggest team setup later. No invitations needed now.', 'يساعدنا في اقتراح إعداد الفريق لاحقاً. لا حاجة لدعوات الآن.')}</span></label><details><summary className="cursor-pointer text-sm font-semibold">{text('Moving from another tool? (optional)', 'تنتقل من أداة أخرى؟ (اختياري)')}</summary><label className="mt-3 block text-sm font-semibold">{text('How do you track customers today?', 'كيف تتابع العملاء الآن؟')}<select value={answers.tracking} onChange={e => update({ tracking: e.target.value as SetupAnswers['tracking'] })} className={control}><option value="none">{text('Starting fresh', 'أبدأ من جديد')}</option><option value="spreadsheet">{text('Spreadsheets', 'جداول البيانات')}</option><option value="another_tool">{text('Another tool', 'أداة أخرى')}</option></select></label></details></>}
          {(step === 3 || step === 4) && <SetupRecommendation answers={answers} standard={standard} review={step === 4} update={update} />}
        </fieldset>
        {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">{step > 1 && <button type="button" disabled={busy} onClick={back} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold dark:border-slate-600">{text('Back', 'السابق')}</button>}<button type="submit" disabled={busy} className={`${primary} ms-auto`}>{busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{busy ? step === 4 ? text('Preparing your workspace…', 'جارٍ تجهيز مساحة العمل…') : text('Saving…', 'جارٍ الحفظ…') : step === 0 ? text('Create account', 'إنشاء الحساب') : step === 4 ? text('Create my workspace', 'أنشئ مساحة عملي') : step === 3 ? text('Accept setup', 'اعتماد الإعداد') : text('Continue', 'التالي')}</button></div>
        {step === 2 && <button type="button" disabled={busy} onClick={e => submit(e, true)} className="w-full rounded-xl py-2 text-sm font-semibold text-purple-700 dark:text-purple-300">{text('Skip and use recommended defaults', 'تجاوز واستخدم الإعدادات المقترحة')}</button>}
        {step === 3 && <button type="button" disabled={busy} onClick={() => update(standard ? {} : { modules: undefined, pipelineStages: undefined }, !standard)} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold dark:border-slate-600">{standard ? text('Use personalized setup', 'استخدم الإعداد المخصص') : text('Use standard setup', 'استخدم الإعداد العام')}</button>}
        {step === 0 ? <div className="space-y-3 text-center"><Link href="/login" className="block text-sm font-semibold text-purple-700 dark:text-purple-300">{text('Already have an account? Sign in', 'لديك حساب؟ سجل الدخول')}</Link><Link href="/legal" className="block text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 dark:text-slate-400">{text('Review legal policy drafts (no acceptance is collected)', 'راجع مسودات السياسات القانونية (لا يتم جمع قبول)')}</Link></div> : <button type="button" disabled={busy} onClick={async () => {
          if (timer.current) clearTimeout(timer.current); setBusy(true);
          try {
            const result = await enqueue(() => saveOnboardingAction({ answers: { ...answers, language }, step, standard }));
            if (!result.success) { setError(message(result.error)); return; }
            await onboardingEventAction('ONBOARDING_ABANDONED'); router.push('/');
          } catch { setError(message()); } finally { setBusy(false); }
        }} className="block w-full rounded-xl py-2 text-center text-sm text-slate-600 dark:text-slate-300">{text('Finish later — sign in to resume', 'أكمل لاحقاً — سجل الدخول للمتابعة')}</button>}
      </form>
    </div>
  </main>;
}
