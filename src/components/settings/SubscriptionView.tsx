'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { requestPlanUpgradeAction } from '@/server/actions/plan-upgrades';
import { activateOrganizationTrialAction } from '@/server/actions/platform';
import type { PlanUpgradeService } from '@/server/services/PlanUpgradeService';
import { planFeatureLabels } from '@/lib/platform/entitlements';
import { usePlanSubmission } from './usePlanSubmission';

export const planPanel = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';
export const planField = 'w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-700';
export const planButton = 'inline-flex rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50';

export function planError(code: string, ar: boolean) {
  const messages: Record<string, [string, string]> = {
    REQUEST_PENDING: ['يوجد طلب دفع أو تفعيل مفتوح لمساحة عملك.', 'Your organization already has an open payment or activation request.'],
    PLAN_UNAVAILABLE: ['الخطة غير متاحة حالياً.', 'This plan is currently unavailable.'],
    PLAN_PRICING_UNAVAILABLE: ['تسعير فترة الفوترة المطلوبة غير مكتمل.', 'Pricing for the requested billing period is not configured.'],
    UPGRADE_REQUIRED: ['اختر خطة أعلى من خطتك الحالية.', 'Choose a plan above your current paid plan.'],
    RENEWAL_INTERVAL_MISMATCH: ['يجب أن يستخدم التجديد المبكر فترة الفوترة الحالية.', 'An early renewal must use the current billing period.'],
    REQUEST_REVIEWED: ['تمت معالجة الطلب مسبقاً.', 'This request has already been processed.'],
    PLAN_CHANGED: ['تغيرت خطة الشركة منذ إرسال الطلب.', 'The company plan changed after this request was submitted.'],
    PAYMENT_MISMATCH: ['المبلغ أو العملة لا يطابقان السعر المحفوظ في الطلب.', 'The amount or currency does not match the request snapshot.'],
    BILLING_POLICY_REQUIRED: ['تم حفظ تأكيد الدفع، لكن سياسة مدة الاشتراك تحتاج اعتماداً قبل التفعيل.', 'Payment confirmation is saved, but an approved subscription-period policy is required before activation.'],
    PAYMENT_CONFIRMATION_REQUIRED: ['يجب استخدام مسار طلب التفعيل وتأكيد الدفع.', 'Use the activation-request and payment-confirmation workflow.'],
    FORBIDDEN: ['ليس لديك صلاحية لتنفيذ هذا الإجراء.', 'You do not have permission for this action.'],
    INVALID_INPUT: ['راجع البيانات المدخلة.', 'Check the entered values.'],
  };
  return messages[code]?.[ar ? 0 : 1] ?? (ar ? 'تعذر حفظ العملية. حاول مرة أخرى.' : 'Unable to save. Please try again.');
}

export function planStatus(value: string, ar: boolean) {
  const statuses: Record<string, string> = { PENDING_PAYMENT: 'بانتظار الدفع', PAYMENT_CONFIRMED: 'تم تأكيد الدفع', ACTIVATED: 'تم التفعيل', REJECTED: 'مرفوض', CANCELLED: 'ملغي', ACTIVE: 'نشط', TRIAL: 'تجريبي', PAST_DUE: 'متأخر', EXPIRED: 'منتهي' };
  return ar ? statuses[value] ?? value : value.replaceAll('_', ' ');
}

function FeatureList({ features, ar }: { features: string[]; ar: boolean }) {
  return <div className="mt-4 flex flex-wrap gap-2">{features.map(feature => <span key={feature} className="rounded-full bg-violet-500/10 px-3 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-300">{planFeatureLabels[feature as keyof typeof planFeatureLabels]?.[ar ? 'ar' : 'en'] ?? feature}</span>)}</div>;
}

export function SubscriptionView({ data }: { data: Awaited<ReturnType<typeof PlanUpgradeService.workspace>> }) {
  const { language } = useI18n(); const ar = language === 'ar';
  const router = useRouter();
  const [planId, setPlanId] = useState(data.plans[0]?.id ?? '');
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>(data.subscription?.billingInterval === 'annual' ? 'annual' : 'monthly');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [pending, startTransition] = usePlanSubmission(() => { setError(true); setMessage(planError('RETRY', ar)); });
  const hasPending = data.requests.some(request => ['PENDING_PAYMENT', 'PAYMENT_CONFIRMED'].includes(request.status));
  const selected = data.plans.find(plan => plan.id === planId);
  return <div className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
    <h1 className="text-3xl font-black">{ar ? 'خطتي وطلبات التفعيل' : 'My plan & activation requests'}</h1>
    <section className={planPanel}>
      <p className="text-sm text-slate-500">{ar ? 'حالة الوصول الحالية' : 'Current access status'}</p>
      <h2 className="mt-2 text-2xl font-bold">{data.subscription?.plan ?? (ar ? 'لا توجد خطة بعد' : 'No assigned plan yet')}</h2>
      {data.subscription && <><p className="mt-2 text-sm">{planStatus(data.subscription.status, ar)} · {data.subscription.billingInterval === 'annual' ? (ar ? 'سنوي' : 'Annual') : (ar ? 'شهري' : 'Monthly')}{data.subscription.endsAt && ` · ${ar ? 'حتى' : 'Until'} ${new Date(data.subscription.endsAt).toLocaleString(ar ? 'ar-JO' : 'en-US')}`}</p>{data.subscription.accessState === 'TRIAL_EXPIRING' && <p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm font-bold text-amber-800">{ar ? 'تنتهي فترتك التجريبية خلال 24 ساعة.' : 'Your trial expires within 24 hours.'}</p>}<p className="mt-5 text-sm font-bold">{ar ? 'الميزات المتاحة' : 'Available features'}</p><FeatureList features={data.subscription.features} ar={ar} /></>}
    </section>
    <form className={`${planPanel} space-y-4`} onSubmit={event => { event.preventDefault(); startTransition(async () => { const result = await requestPlanUpgradeAction({ planId, billingInterval, reason }); setError(!result.success); setMessage(result.success ? (ar ? 'تم استلام طلبك وهو الآن بانتظار تنسيق الدفع. سيتواصل معك فريق CodeLine عبر واتساب عند توفر رقم صالح، أو عبر بريدك المسجل.' : 'Your request was received and is pending payment coordination. CodeLine will contact you through WhatsApp when a valid number is available, or through your registered email.') : planError(result.error, ar)); if (result.success) { setReason(''); router.refresh(); } }); }}>
      <h2 className="text-xl font-bold">{ar ? 'اختيار خطة وطلب التفعيل' : 'Choose a plan and request activation'}</h2>
      <p className="text-sm text-slate-500">{ar ? 'إرسال الطلب لا يعني نجاح الدفع أو تفعيل الاشتراك. يتم التفعيل فقط بعد التحقق من التحويل البنكي بواسطة مدير منصة مخول.' : 'Submitting a request does not mean payment succeeded or the subscription is active. Activation occurs only after an authorized platform administrator verifies the bank transfer.'}</p>
      {hasPending ? <p role="status" className="rounded-xl bg-amber-500/10 p-3 text-sm">{ar ? 'يوجد طلب مفتوح حالياً. راجع حالته أدناه.' : 'There is already an open request. Review its status below.'}</p> : data.plans.length ? <>
        <label className="block text-sm">{ar ? 'الخطة المطلوبة' : 'Requested plan'}<select className={`${planField} mt-2`} value={planId} onChange={event => setPlanId(event.target.value)}>{data.plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {billingInterval === 'annual' ? plan.annualPrice : plan.monthlyPrice} {plan.currency} · {plan.userLimit ?? (ar ? 'غير محدود' : 'Unlimited')} {ar ? 'مستخدم' : 'users'}</option>)}</select></label>
        {selected && <div><p className="text-sm font-bold">{ar ? 'الميزات بعد التفعيل' : 'Features after activation'}</p><FeatureList features={selected.features} ar={ar} /></div>}
        <label className="block text-sm">{ar ? 'فترة الفوترة' : 'Billing period'}<select className={`${planField} mt-2`} value={billingInterval} onChange={event => setBillingInterval(event.target.value as 'monthly' | 'annual')}><option value="monthly">{ar ? 'شهري' : 'Monthly'}</option><option value="annual">{ar ? 'سنوي' : 'Annual'}</option></select></label>
        <label className="block text-sm">{ar ? 'ملاحظة (اختياري)' : 'Note (optional)'}<textarea maxLength={2000} className={`${planField} mt-2`} value={reason} onChange={event => setReason(event.target.value)} /></label>
        <button disabled={pending || !planId} className={planButton}>{pending ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : (ar ? 'طلب التفعيل' : 'Request activation')}</button>
      </> : <p className="text-sm text-slate-500">{ar ? 'لا توجد خطط خدمة ذاتية متاحة حالياً.' : 'No self-service plans are currently available.'}</p>}
      {message && <p role={error ? 'alert' : 'status'} className={error ? 'text-sm text-red-600' : 'text-sm text-emerald-600'}>{message}</p>}
    </form>
    <section className={planPanel}><h2 className="mb-4 text-xl font-bold">{ar ? 'طلباتي' : 'My requests'}</h2>{data.requests.length ? <div className="space-y-3">{data.requests.map(request => <div key={request.id} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="font-bold">{request.plan} · {planStatus(request.status, ar)}</p><p className="mt-1 text-xs text-slate-500">{request.priceSnapshot === null ? '' : `${request.priceSnapshot} ${request.currencySnapshot ?? ''}${request.pricingVersionSnapshot ? ` · v${request.pricingVersionSnapshot}` : ''} · `}{new Date(request.createdAt).toLocaleString(ar ? 'ar-JO' : 'en-US')}</p>{request.reviewNote && <p className="mt-2 whitespace-pre-wrap text-sm">{request.reviewNote}</p>}</div>)}</div> : <p className="text-sm text-slate-500">{ar ? 'لا توجد طلبات بعد.' : 'No requests yet.'}</p>}</section>
  </div>;
}

export function CompanyPlanEditor({ organizationId, plans, current }: { organizationId: string; plans: { id: string; name: string }[]; current: { planId: string; billingInterval: string } | null }) {
  void organizationId; void plans; void current;
  const { language } = useI18n(); const ar = language === 'ar';
  return <section className={`${planPanel} space-y-3`}><h2 className="text-xl font-bold">{ar ? 'تفعيل اشتراك الشركة' : 'Activate company subscription'}</h2><p className="text-sm text-slate-500">{ar ? 'التفعيل المباشر معطل. استخدم طلب التفعيل، ثم سجّل تأكيد التحويل البنكي من شاشة طلبات الدفع.' : 'Direct activation is disabled. Use an activation request, then record verified bank-transfer payment from the payment requests screen.'}</p><Link href="/admin/platform/upgrade-requests" className={planButton}>{ar ? 'عرض طلبات الدفع' : 'View payment requests'}</Link></section>;
}

export function CompanyTrialEditor({ organizationId, plans, current }: { organizationId: string; plans: { id: string; name: string }[]; current: { planId: string; status: string; trialEndsAt: string | null; endsAt: string | null } | null }) {
  const { language } = useI18n(); const ar = language === 'ar';
  const [planId, setPlanId] = useState(current?.planId ?? plans[0]?.id ?? '');
  const [durationDays, setDurationDays] = useState('7');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [pending, startTransition] = usePlanSubmission(() => { setError(true); setMessage(ar ? 'تعذر تفعيل التجربة المجانية.' : 'Unable to activate the free trial.'); });
  return <section className={`${planPanel} space-y-4`} dir={ar ? 'rtl' : 'ltr'}>
    <div>
      <h2 className="text-xl font-bold">{ar ? 'تفعيل تجربة مجانية للشركة' : 'Activate a company free trial'}</h2>
      <p className="mt-2 text-sm text-slate-500">{ar ? 'حدد الخطة والمدة. بعد انتهاء المدة سيُطبّق نفس سلوك انتهاء التجربة الحالي تلقائياً.' : 'Choose the plan and duration. After the duration ends, the existing trial-expiry behavior is applied automatically.'}</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold">{ar ? 'الخطة' : 'Plan'}<select className={`${planField} mt-2`} value={planId} onChange={event => setPlanId(event.target.value)} disabled={pending}><option value="">{ar ? 'اختر الخطة' : 'Select a plan'}</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
      <label className="block text-sm font-semibold">{ar ? 'مدة التجربة (بالأيام)' : 'Trial duration (days)'}<input className={`${planField} mt-2`} type="number" min={1} max={3650} value={durationDays} onChange={event => setDurationDays(event.target.value)} disabled={pending} required /></label>
    </div>
    {current?.status === 'TRIAL' && current.trialEndsAt && <p className="rounded-xl bg-amber-500/10 p-3 text-sm font-semibold">{ar ? 'هذه الشركة لديها تجربة حالية تنتهي في: ' : 'This company currently has a trial ending: '}{new Date(current.trialEndsAt).toLocaleString(ar ? 'ar-JO' : 'en-US')}</p>}
    {current?.status === 'ACTIVE' && <p className="rounded-xl bg-slate-500/10 p-3 text-sm">{ar ? 'يوجد اشتراك مدفوع نشط؛ لا يمكن استبداله بتجربة مجانية.' : 'A paid subscription is active; it cannot be replaced with a free trial.'}</p>}
    <button type="button" className={planButton} disabled={pending || !planId} onClick={() => startTransition(async () => { const response = await activateOrganizationTrialAction({ organizationId, planId, durationDays: Number(durationDays) }); setError(!response.success); setMessage(response.success ? (ar ? `تم تفعيل التجربة حتى ${new Date(response.endsAt).toLocaleString('ar-JO')}.` : `Trial activated until ${new Date(response.endsAt).toLocaleString('en-US')}.`) : (ar ? 'تعذر تفعيل التجربة المجانية.' : 'Unable to activate the free trial.')); })}>{pending ? (ar ? 'جارٍ التفعيل…' : 'Activating…') : (ar ? 'تفعيل التجربة المجانية' : 'Activate free trial')}</button>
    {message && <p role={error ? 'alert' : 'status'} className={error ? 'text-sm text-red-600' : 'text-sm text-emerald-600'}>{message}</p>}
  </section>;
}
