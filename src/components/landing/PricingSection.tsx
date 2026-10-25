'use client';

import Link from 'next/link';
import { ArrowUpRight, Check, Minus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { expandPlanFeatures, planFeatureLabels, type PlanFeatureId } from '@/lib/platform/entitlements';
import { getAnnualSavings, type BillingInterval, type PlanConfig } from '@/lib/plans';
import { SALES_HREF } from './MarketingShell';
import s from './marketing.module.css';

const FEATURE_PRIORITY: PlanFeatureId[] = [
  'clients', 'contacts', 'leads', 'deals', 'pipelines', 'tasks', 'tickets', 'team',
  'custom_fields', 'import_export', 'search', 'reports', 'workflows', 'audit_logs', 'ai_assistant',
];

const COMPARISON_FEATURES: PlanFeatureId[] = [
  'clients', 'pipelines', 'tasks', 'team', 'custom_fields', 'import_export', 'reports', 'workflows', 'audit_logs', 'ai_assistant',
];

function visibleFeatures(plan: PlanConfig) {
  const enabled = new Set(expandPlanFeatures(plan.features));
  return FEATURE_PRIORITY.filter(feature => enabled.has(feature)).slice(0, 6);
}

export function PricingSection({ standalone = false, plans }: { standalone?: boolean; plans: readonly PlanConfig[] }) {
  const { language } = useI18n();
  const ar = language === 'ar';
  const t = ar ? {
    label: 'باقات واضحة لفريقك', title: 'اختر نقطة البداية المناسبة لنموك.', lead: 'أسعار واضحة بالدينار الأردني، مع تجربة Starter مجانية لمدة سبعة أيام لكل مساحة عمل جديدة.',
    notice: 'تُدفع الباقة السنوية لفترة 12 شهراً. يتم تفعيل الباقات المدفوعة بعد تنسيق الدفع والتحقق من التحويل البنكي.',
    monthly: 'شهري', annual: 'سنوي', recommended: 'الأفضل للفرق النامية', custom: 'تواصل معنا', month: 'شهرياً', year: 'سنوياً',
    users: 'مستخدمين', customUsers: 'عدد المستخدمين حسب الاتفاق', start: 'ابدأ التجربة المجانية', contact: 'تواصل مع المبيعات', save: 'وفّر', currency: 'د.أ',
    compare: 'قارن القدرات الفعلية.', compareLead: 'تعكس المقارنة المزايا المفعّلة في كتالوج الباقات الحالي.', caption: 'مقارنة باقات CodeLine CRM', feature: 'القدرة أو الحد', included: 'متاح', usersRow: 'حد المستخدمين', foot: 'قد تتطلب مزايا الذكاء الاصطناعي والتكاملات إعداد مزود الخدمة. تسري صلاحيات المستخدم والمؤسسة على جميع الباقات.',
  } : {
    label: 'Straightforward plans for your team', title: 'Choose the right starting point for growth.', lead: 'Clear JOD pricing, with a free seven-day Starter trial for every new workspace.',
    notice: 'Annual plans cover a 12-month period. Paid plans are activated after payment coordination and verified bank transfer.',
    monthly: 'Monthly', annual: 'Annual', recommended: 'Best for growing teams', custom: 'Contact Sales', month: 'per month', year: 'per year',
    users: 'users', customUsers: 'Users agreed with sales', start: 'Start Free Trial', contact: 'Contact Sales', save: 'Save', currency: 'JOD',
    compare: 'Compare real capabilities.', compareLead: 'This comparison reflects the capabilities enabled in the current plan catalogue.', caption: 'CodeLine CRM plan comparison', feature: 'Capability or limit', included: 'Included', usersRow: 'User limit', foot: 'AI and integration capabilities may require provider configuration. User and organization permissions apply across every plan.',
  };
  const Heading = standalone ? 'h1' : 'h2';
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  const number = new Intl.NumberFormat(ar ? 'ar-JO' : 'en-US');

  return <section id="pricing" className={s.pricingSection} aria-labelledby="pricing-title"><div className={s.container}>
    <div className={s.pricingHeading}><span className={s.sectionLabel}>{t.label}</span><Heading id="pricing-title">{t.title}</Heading><p>{t.lead}</p><div className={s.pricingNotice}>{t.notice}</div><div className={s.billingToggle} role="group" aria-label={ar ? 'فترة الفوترة' : 'Billing interval'}><button type="button" className={billingInterval === 'monthly' ? s.billingActive : ''} aria-pressed={billingInterval === 'monthly'} onClick={() => setBillingInterval('monthly')}>{t.monthly}</button><button type="button" className={billingInterval === 'annual' ? s.billingActive : ''} aria-pressed={billingInterval === 'annual'} onClick={() => setBillingInterval('annual')}>{t.annual}</button></div></div>
    <div className={s.plans}>{plans.map(plan => {
      const annual = billingInterval === 'annual';
      const price = annual ? plan.annualPrice : plan.monthlyPrice;
      const savings = annual ? getAnnualSavings(plan) : null;
      return <article key={plan.id} className={`${s.plan} ${plan.recommended ? s.recommendedPlan : ''}`}>
        <div className={s.planFlag}>{plan.recommended ? t.recommended : '\u00a0'}</div><h3 translate="no">{plan.name}</h3><p className={s.planDescription}>{plan.description[language]}</p>
        <div className={s.planPrice}>{price === null ? <strong className={s.customPrice}>{t.custom}</strong> : <><strong>{number.format(Number(price))}</strong><span><b>{plan.currency}</b><br />{annual ? t.year : t.month}</span></>}</div>
        {savings !== null && <p className={s.savings}>{t.save} {number.format(Number(savings))} {plan.currency}</p>}
        <p className={s.userAllowance}><UsersRound aria-hidden="true" />{plan.userLimit === null ? t.customUsers : `${number.format(plan.userLimit)} ${t.users}`}</p>
        {plan.availability === 'contact_sales' ? <a href={SALES_HREF} className={s.planButton}>{t.contact}<ArrowUpRight aria-hidden="true" /></a> : <Link href="/onboarding" className={s.planButton}>{t.start}<ArrowUpRight aria-hidden="true" /></Link>}
        <ul>{visibleFeatures(plan).map(feature => <li key={feature}><Check aria-hidden="true" /><span>{planFeatureLabels[feature][language]}</span></li>)}</ul>
      </article>;
    })}</div>
    <div id="compare" className={s.comparison}><div className={s.sectionHeading}><h2>{t.compare}</h2><p>{t.compareLead}</p></div><div className={s.tableScroll} role="region" aria-label={t.caption} tabIndex={0}><table><caption className={s.srOnly}>{t.caption}</caption><thead><tr><th scope="col">{t.feature}</th>{plans.map(plan => <th scope="col" key={plan.id} translate="no">{plan.name}</th>)}</tr></thead><tbody>
      <tr><th scope="row">{t.usersRow}</th>{plans.map(plan => <td key={plan.id}>{plan.userLimit === null ? '—' : number.format(plan.userLimit)}</td>)}</tr>
      {COMPARISON_FEATURES.map(feature => <tr key={feature}><th scope="row">{planFeatureLabels[feature][language]}</th>{plans.map(plan => { const included = expandPlanFeatures(plan.features).includes(feature); return <td key={plan.id}>{included ? <span className={s.tableIncluded}><Check aria-hidden="true" />{t.included}</span> : <Minus aria-label={ar ? 'غير متاح' : 'Not included'} />}</td>; })}</tr>)}
    </tbody></table></div><p className={s.finePrint}>{t.foot}</p></div>
  </div></section>;
}
