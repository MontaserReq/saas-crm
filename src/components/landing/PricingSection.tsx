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
  'custom_fields', 'import_export', 'search', 'reports', 'workflows', 'audit_logs',
];

type ComparisonCell = { en: string; ar: string; included: boolean };
type ComparisonRow = {
  id: string;
  label: { en: string; ar: string };
  value: (plan: PlanConfig) => ComparisonCell;
};

const available = (en: string, ar: string): ComparisonCell => ({ en, ar, included: true });
const unavailable = (en = 'Not included', ar = 'غير متاح'): ComparisonCell => ({ en, ar, included: false });

function hasPlanToken(plan: PlanConfig, token: string) {
  return plan.features.includes(token);
}

function comparisonTier(plan: PlanConfig, tokens: { basic?: string; advanced?: string; custom?: string }, labels: { basic: [string, string]; advanced: [string, string]; custom?: [string, string] }) {
  if (tokens.custom && hasPlanToken(plan, tokens.custom) && labels.custom) return available(labels.custom[0], labels.custom[1]);
  if (tokens.advanced && hasPlanToken(plan, tokens.advanced)) return available(labels.advanced[0], labels.advanced[1]);
  if (tokens.basic && hasPlanToken(plan, tokens.basic)) return available(labels.basic[0], labels.basic[1]);
  return unavailable();
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    id: 'crm', label: { en: 'Customers, contacts & sales', ar: 'العملاء وجهات الاتصال والمبيعات' },
    value: plan => hasPlanToken(plan, 'crm') ? available('Core CRM', 'أساسيات CRM') : unavailable(),
  },
  {
    id: 'tasks', label: { en: 'Tasks, calendar & tickets', ar: 'المهام والتقويم والتذاكر' },
    value: plan => hasPlanToken(plan, 'tasks') ? available('Core operations', 'العمليات الأساسية') : unavailable(),
  },
  {
    id: 'team', label: { en: 'Team roles & permissions', ar: 'أدوار الفريق والصلاحيات' },
    value: plan => comparisonTier(plan, { basic: 'permissions', advanced: 'permissions-advanced' }, { basic: ['Basic roles', 'أدوار أساسية'], advanced: ['Advanced controls', 'تحكم متقدم'] }),
  },
  {
    id: 'custom-fields', label: { en: 'Custom fields', ar: 'الحقول المخصصة' },
    value: plan => {
      if (plan.id === 'enterprise') return available('Custom model', 'نموذج مخصص');
      return comparisonTier(plan, { basic: 'custom-fields', advanced: 'custom-fields-expanded' }, { basic: ['Basic fields', 'حقول أساسية'], advanced: ['Expanded fields', 'حقول موسعة'] });
    },
  },
  {
    id: 'import', label: { en: 'Import, mapping & assignments', ar: 'الاستيراد ومطابقة الأعمدة والتعيينات' },
    value: plan => {
      if (hasPlanToken(plan, 'import-advanced')) return available('Advanced import', 'استيراد متقدم');
      if (hasPlanToken(plan, 'import-mappings')) return available('Mapped import', 'استيراد مع مطابقة الأعمدة');
      if (hasPlanToken(plan, 'import-export')) return available('Basic import', 'استيراد أساسي');
      return unavailable();
    },
  },
  {
    id: 'reports', label: { en: 'Reports & analytics', ar: 'التقارير والتحليلات' },
    value: plan => {
      if (hasPlanToken(plan, 'analytics-advanced')) return available('Advanced analytics', 'تحليلات متقدمة');
      if (hasPlanToken(plan, 'analytics')) return available('Analytics', 'تحليلات');
      if (hasPlanToken(plan, 'reports')) return available('Standard reports', 'تقارير أساسية');
      return unavailable();
    },
  },
  {
    id: 'workflows', label: { en: 'Workflow automation', ar: 'أتمتة سير العمل' },
    value: plan => comparisonTier(plan, { basic: 'workflows', advanced: 'workflows-advanced' }, { basic: ['Standard automation', 'أتمتة أساسية'], advanced: ['Advanced automation', 'أتمتة متقدمة'] }),
  },
  {
    id: 'audit', label: { en: 'Audit & governance', ar: 'التدقيق والحوكمة' },
    value: plan => comparisonTier(plan, { basic: 'audit-expanded', advanced: 'audit-governance' }, { basic: ['Audit history', 'سجل تدقيق'], advanced: ['Governance controls', 'ضوابط حوكمة'] }),
  },
  {
    id: 'integrations', label: { en: 'External integrations', ar: 'التكاملات الخارجية' },
    value: plan => comparisonTier(plan, { basic: 'integrations', custom: 'custom-integrations' }, { basic: ['Standard integrations', 'تكاملات أساسية'], advanced: ['Standard integrations', 'تكاملات أساسية'], custom: ['Custom integrations', 'تكاملات مخصصة'] }),
  },
  {
    id: 'service', label: { en: 'Onboarding & support', ar: 'الإعداد والدعم' },
    value: plan => {
      if (hasPlanToken(plan, 'assisted-onboarding')) return available('Assisted onboarding', 'إعداد بمرافقة فريقنا');
      if (hasPlanToken(plan, 'priority-support-proposed')) return available('Priority support', 'دعم ذو أولوية');
      if (plan.id === 'growth') return available('Standard support', 'دعم قياسي');
      return available('Self-serve', 'دعم ذاتي');
    },
  },
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
    compare: 'قارن القدرات الفعلية.', compareLead: 'تعرض المقارنة مستوى كل قدرة كما هو محدد في كتالوج الباقات الحالي، وليس مجرد وجودها أو غيابها.', caption: 'مقارنة باقات CodeLine CRM', feature: 'القدرة أو الحد', included: 'متاح', usersRow: 'حد المستخدمين', foot: 'قد تتطلب التكاملات المتقدمة إعداد مزود الخدمة. تسري صلاحيات المستخدم والمؤسسة على جميع الباقات.',
  } : {
    label: 'Straightforward plans for your team', title: 'Choose the right starting point for growth.', lead: 'Clear JOD pricing, with a free seven-day Starter trial for every new workspace.',
    notice: 'Annual plans cover a 12-month period. Paid plans are activated after payment coordination and verified bank transfer.',
    monthly: 'Monthly', annual: 'Annual', recommended: 'Best for growing teams', custom: 'Contact Sales', month: 'per month', year: 'per year',
    users: 'users', customUsers: 'Users agreed with sales', start: 'Start Free Trial', contact: 'Contact Sales', save: 'Save', currency: 'JOD',
    compare: 'Compare real capabilities.', compareLead: 'The table shows the level of each capability in the current plan catalogue, not just a generic included or excluded flag.', caption: 'CodeLine CRM plan comparison', feature: 'Capability or limit', included: 'Included', usersRow: 'User limit', foot: 'Advanced integrations may require provider configuration. User and organization permissions apply across every plan.',
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
      {COMPARISON_ROWS.map(row => <tr key={row.id}><th scope="row">{row.label[language]}</th>{plans.map(plan => { const cell = row.value(plan); return <td key={plan.id}>{cell.included ? <span className={s.comparisonValue}><Check aria-hidden="true" />{cell[language]}</span> : <span className={s.comparisonUnavailable}><Minus aria-hidden="true" />{cell[language]}</span>}</td>; })}</tr>)}
    </tbody></table></div><p className={s.finePrint}>{t.foot}</p></div>
  </div></section>;
}
