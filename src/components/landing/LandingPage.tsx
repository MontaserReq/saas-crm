'use client';

import { ArrowUpRight, Check, FileSliders, GitBranch, ListTodo, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { APP_URL, MarketingShell, FinalCta, MarketingFaq } from './MarketingShell';
import { PricingSection } from './PricingSection';
import { ProductPreview, TaskPreview } from './ProductPreview';
import { faqCopy, landingCopy } from './content';
import s from './marketing.module.css';
import type { PlanConfig } from '@/lib/plans';

export default function LandingPage({ plans }: { plans: PlanConfig[] }) {
  const { language } = useI18n();
  const t = landingCopy[language];
  const heroTitle = language === 'ar'
    ? ['حوّل كل علاقة إلى', 'فرصة للنمو.']
    : ['Turn Every Relationship', 'Into Growth.'];
  const siteUrl = language === 'en' ? 'https://satrcrm.com/en' : 'https://satrcrm.com/';
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://satrcrm.com/#organization',
        name: 'SatrCRM',
        alternateName: 'CodeLine CRM',
        url: 'https://satrcrm.com/',
        logo: {
          '@type': 'ImageObject',
          url: 'https://satrcrm.com/branding/icons/app-512.png',
          width: 512,
          height: 512,
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}#website`,
        name: 'SatrCRM',
        url: siteUrl,
        inLanguage: language,
        publisher: { '@id': 'https://satrcrm.com/#organization' },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'SatrCRM',
        alternateName: language === 'ar' ? 'منصة ساتر CRM' : 'CodeLine CRM',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: siteUrl,
        description: t.lead,
        inLanguage: ['ar', 'en'],
        featureList: language === 'ar'
          ? ['إدارة العملاء وجهات الاتصال', 'مسارات المبيعات والصفقات', 'المهام والتذاكر والتقويم', 'الرسائل ومحادثة الفريق', 'الأدوار والصلاحيات والتقارير']
          : ['Customer and contact management', 'Deals and sales pipelines', 'Tasks, tickets and calendar', 'Messages and team chat', 'Roles, permissions and reporting'],
        offers: plans.map((plan) => ({
          '@type': 'Offer',
          name: plan.name,
          price: plan.monthlyPrice ?? plan.annualPrice ?? undefined,
          priceCurrency: plan.currency,
          availability: 'https://schema.org/InStock',
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqCopy[language].items.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
    ],
  };
  return <MarketingShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <section className={s.hero} aria-labelledby="hero-title">
      <div className={`${s.container} ${s.heroGrid}`}>
        <div className={s.heroCopy}>
          <p className={s.productLabel}><span />{t.label}</p>
          <h1 id="hero-title"><span>{heroTitle[0]}</span><strong>{heroTitle[1]}</strong></h1>
          <p className={s.lead}>{t.lead}</p>
          <div className={s.actions}><a className={s.primary} href={`${APP_URL}/onboarding`}>{t.start}<ArrowUpRight aria-hidden="true" /></a><a className={s.secondary} href="#features">{t.explore}<ArrowUpRight aria-hidden="true" /></a></div>
          <p className={s.heroNote}><Check aria-hidden="true" />{t.note}</p>
        </div>
        <ProductPreview />
      </div>
      <div className={`${s.container} ${s.heroFoot}`}><span>{t.builtFor}</span><div>{t.audiences.map(label => <span key={label}>{label}</span>)}</div></div>
    </section>
    <section className={`${s.container} ${s.section}`} aria-labelledby="benefits-title">
      <div className={s.sectionHeading}><h2 id="benefits-title">{t.benefitTitle}</h2><p>{t.benefitLead}</p></div>
      <div className={s.benefits}>{t.benefits.map(([title, text], i) => { const Icon = [UsersRound, GitBranch, ListTodo][i]; return <article key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>; })}</div>
    </section>
    <section id="features" className={s.showcase} aria-labelledby="features-title">
      <div className={s.container}>
        <div className={s.showcaseHeading}><span className={s.sectionLabel}>{t.featureLabel}</span><h2 id="features-title">{t.featureTitle}</h2><p>{t.featureLead}</p></div>
        <div className={s.operationsGrid}><div className={s.operationsCopy}><span className={s.pill}><ListTodo aria-hidden="true" />{t.operationsLabel}</span><h3>{t.operationsTitle}</h3><p>{t.operationsLead}</p><ul className={s.checkList}>{t.operationsItems.map(item => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul></div><TaskPreview /></div>
      </div>
    </section>
    <section className={`${s.container} ${s.section} ${s.dataGrid}`} aria-labelledby="data-title">
      <div className={s.fieldPreview}><div className={s.previewHeading}><FileSliders aria-hidden="true" /><strong>{t.fieldsLabel}</strong><span>{t.sample}</span></div><div className={s.fieldRows}>{t.fields.map(([name, type, value]) => <div key={name}><span>{name}<small>{type}</small></span><strong>{value}</strong></div>)}</div><div className={s.fieldFooter}><Check aria-hidden="true" />{t.fieldFooter}</div></div>
      <div><span className={s.sectionLabel}>{t.dataLabel}</span><h2 id="data-title">{t.dataTitle}</h2><p className={s.bodyLead}>{t.dataLead}</p><p className={s.finePrint}>{t.importNote}</p><a className={s.textLink} href="#faq">{t.importLink}<ArrowUpRight aria-hidden="true" /></a></div>
    </section>
    <section className={s.capabilities} aria-label={t.moreLabel}><div className={`${s.container} ${s.capabilityGrid}`}>
      {t.capabilities.map(([title, text], i) => { const Icon = [GitBranch, ShieldCheck][i]; return <article key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>; })}
    </div></section>
    <section id="workflow" className={`${s.container} ${s.section}`} aria-labelledby="workflow-title">
      <div className={s.sectionHeading}><h2 id="workflow-title">{t.stepsTitle}</h2><p>{t.stepsLead}</p></div>
      <ol className={s.steps}>{t.steps.map(([title, text], i) => <li key={title}><span className={s.stepNumber}>{String(i + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{text}</p></li>)}</ol>
      <div className={s.fit}><Search aria-hidden="true" /><div><h3>{t.fitTitle}</h3><p>{t.fitText}</p></div><a className={s.textLink} href={`${APP_URL}/onboarding`}>{t.start}<ArrowUpRight aria-hidden="true" /></a></div>
    </section>
    <PricingSection plans={plans} />
    <section className={`${s.container} ${s.section} ${s.trust}`} aria-labelledby="trust-title"><div><span className={s.sectionLabel}><ShieldCheck aria-hidden="true" />{t.trustLabel}</span><h2 id="trust-title">{t.trustTitle}</h2><p className={s.bodyLead}>{t.trustLead}</p></div><div className={s.trustList}>{t.trustItems.map(([title, text]) => <article key={title}><Check aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>
    <MarketingFaq />
    <FinalCta />
  </MarketingShell>;
}
