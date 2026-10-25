'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { requestSubscriptionSupportAction } from '@/server/actions/plan-upgrades';
import type { PlanUpgradeService } from '@/server/services/PlanUpgradeService';
import { planButton, planPanel } from './SubscriptionView';
import { usePlanSubmission } from './usePlanSubmission';
import type { WorkspaceAccessState } from '@/lib/platform/entitlements';

export function TrialExpiredView({ data, state }: { data: Awaited<ReturnType<typeof PlanUpgradeService.workspace>>; state: Extract<WorkspaceAccessState, 'TRIAL_EXPIRED' | 'PAID_EXPIRED'> }) {
  const { language } = useI18n(); const ar = language === 'ar';
  const trial = state === 'TRIAL_EXPIRED';
  const [message, setMessage] = useState('');
  const [result, setResult] = useState('');
  const [pending, startTransition] = usePlanSubmission(() => setResult(ar ? 'تعذر إرسال طلب الدعم.' : 'Unable to send the support request.'));
  return <div className="mx-auto max-w-5xl space-y-6" dir={ar ? 'rtl' : 'ltr'}>
    <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-7 shadow-sm dark:border-amber-900 dark:from-amber-950/30 dark:to-slate-900 sm:p-10">
      <p className="text-sm font-bold uppercase tracking-widest text-violet-600">CodeLine CRM</p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">{trial ? (ar ? 'انتهت فترتك التجريبية' : 'Your trial has ended') : (ar ? 'انتهى اشتراكك المدفوع' : 'Your paid subscription has expired')}</h1>
      <p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">{trial ? (ar ? 'انتهت فترتك التجريبية المجانية في CodeLine CRM. بيانات مساحة عملك محفوظة، ويمكنك اختيار الخطة المناسبة وطلب تفعيلها لاستكمال استخدام الميزات.' : 'Your free trial in CodeLine CRM has ended. Your workspace data is preserved. Choose a suitable plan and request activation to continue using paid functionality.') : (ar ? 'انتهى اشتراك CodeLine CRM المدفوع. بيانات مساحة عملك محفوظة، ويمكنك اختيار خطة وطلب إعادة التفعيل.' : 'Your paid CodeLine CRM subscription has expired. Your workspace data is preserved; choose a plan and request reactivation.')}</p>
      <p className="mt-3 text-sm font-bold text-amber-800 dark:text-amber-200">{ar ? 'يمكنك الاستمرار في عرض البيانات المسموح بها، لكن عمليات الكتابة محظورة حتى تفعيل اشتراك مدفوع.' : 'You may continue viewing permitted data, but CRM write operations are blocked until a paid subscription is activated.'}</p>
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/settings/subscription" className={planButton}>{ar ? 'اختيار الخطة وطلب التفعيل' : 'Choose a plan and request activation'}</Link><Link href="/settings/subscription" className="rounded-xl border px-5 py-3 text-sm font-bold">{ar ? 'عرض خططي وطلباتي' : 'View my plans and requests'}</Link></div>
    </section>
    <section className="grid gap-4 md:grid-cols-3">{data.plans.map(plan => <article key={plan.id} className={planPanel}><h2 className="text-xl font-black">{plan.name}</h2><p className="mt-3 text-sm">{plan.monthlyPrice} {plan.currency} / {ar ? 'شهر' : 'month'}</p><p className="mt-1 text-sm">{plan.annualPrice} {plan.currency} / {ar ? 'سنة' : 'year'}</p><Link href="/settings/subscription" className="mt-5 inline-flex text-sm font-bold text-violet-600">{ar ? 'طلب التفعيل' : 'Request activation'}</Link></article>)}</section>
    <section className={`${planPanel} space-y-3`}><h2 className="text-xl font-black">{ar ? 'التواصل مع الدعم' : 'Contact support'}</h2><textarea className="min-h-24 w-full rounded-xl border bg-transparent p-3" maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} placeholder={ar ? 'أضف رسالة اختيارية' : 'Add an optional message'} /><button disabled={pending} className={planButton} onClick={() => startTransition(async () => { const response = await requestSubscriptionSupportAction({ message }); setResult(response.success ? (ar ? 'تم إرسال طلب الدعم.' : 'Support request sent.') : (ar ? 'تعذر إرسال طلب الدعم.' : 'Unable to send the support request.')); if (response.success) setMessage(''); })}>{ar ? 'إرسال طلب دعم' : 'Send support request'}</button>{result && <p role="status" className="text-sm">{result}</p>}</section>
  </div>;
}
