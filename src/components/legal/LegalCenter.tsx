'use client';

import Link from 'next/link';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useI18n } from '@/lib/i18n/context';
import { LEGAL_POLICIES, type LegalPolicy } from '@/lib/legal/policies';
import s from './legal.module.css';

function LegalShell({ children }: { children: React.ReactNode }) {
  const { language } = useI18n();
  const ar = language === 'ar';
  return <div className={s.site} dir={ar ? 'rtl' : 'ltr'}>
    <a className={s.skipLink} href="#legal-main">{ar ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>
    <header className={s.header}><div className={`${s.container} ${s.headerInner}`}>
      <Link href="/" className={s.logo} aria-label="SatrCRM"><BrandLogo className={s.logoImage} /></Link>
      <nav className={s.nav} aria-label={ar ? 'التنقل القانوني' : 'Legal navigation'}><Link href="/legal">{ar ? 'مركز السياسات' : 'Policies Center'}</Link><Link href="/pricing">{ar ? 'الباقات' : 'Pricing'}</Link><a href="mailto:info@codeline.jo">{ar ? 'تواصل' : 'Contact'}</a></nav>
      <div className={s.tools}><LanguageSwitcher /><ThemeToggle /></div>
    </div></header>
    {children}
    <footer className={s.footer}><div className={`${s.container} ${s.footerInner}`}><span>© {new Date().getUTCFullYear()} SatrCRM</span><div className={s.footerLinks}><Link href="/">{ar ? 'الرئيسية' : 'Home'}</Link><Link href="/legal">{ar ? 'السياسات' : 'Policies'}</Link><a href="mailto:info@codeline.jo">info@codeline.jo</a></div></div></footer>
  </div>;
}

export function LegalIndex() {
  const { language } = useI18n();
  const ar = language === 'ar';
  return <LegalShell>
    <main id="legal-main">
      <section className={s.hero}><div className={s.container}><span className={s.eyebrow}>{ar ? 'الحوكمة والشفافية' : 'Governance & transparency'}</span><h1>{ar ? 'مركز السياسات القانونية' : 'Legal Policies Center'}</h1><p className={s.heroLead}>{ar ? 'هيكل ثنائي اللغة لمسودات شروط CodeLine CRM وخصوصيتها وأمنها واستخدامها. أُعدت هذه الصفحات للمراجعة وليست شروطًا نافذة.' : 'A bilingual review structure for CodeLine CRM terms, privacy, security and use. These pages are prepared for review and are not effective terms.'}</p><div className={s.heroMeta}><span className={s.pill}>{ar ? 'الإصدار: draft-0.1' : 'Version: draft-0.1'}</span><span className={s.pill}>{ar ? 'آخر تحديث: 20 أكتوبر 2026' : 'Last updated: 20 October 2026'}</span><span className={s.pill}>{ar ? 'لا يوجد قبول ملزم' : 'No binding acceptance'}</span></div></div></section>
      <div className={`${s.container} ${s.main}`}>
        <div className={s.introGrid}><article className={s.infoCard}><h2>{ar ? 'ما تم التحقق منه' : 'What is verified'}</h2><p>{ar ? 'تستند المسودات إلى مسارات التطبيق الحالية: الحسابات، عزل المؤسسات، الصلاحيات، الفترة التجريبية، القراءة فقط، الدفع اليدوي، التصدير، التكاملات والذكاء الاصطناعي.' : 'Drafts follow current application paths for accounts, tenant isolation, permissions, trial/read-only access, manual payment, exports, integrations and AI.'}</p></article><article className={s.infoCard}><h2>{ar ? 'ما لا يزال مفتوحًا' : 'What remains open'}</h2><p>{ar ? 'هوية الكيان القانوني، تفاصيل الإنتاج والمعالجون الفرعيون والاحتفاظ والضرائب وسياسة الاسترداد ومستويات الدعم والقانون والاختصاص النهائي.' : 'Legal entity identity, production details, subprocessors, retention, tax, refunds, support levels, and final governing-law/jurisdiction terms.'}</p></article></div>
        <div className={s.sectionHeading}><h2>{ar ? 'الوثائق' : 'Documents'}</h2><p>{ar ? 'لكل سياسة رابط مستقل ونطاق وعناصر مراجعة واضحة.' : 'Each policy has a stable route, scope and clear review status.'}</p></div>
        <div className={s.cards}>{LEGAL_POLICIES.map((policy, index) => <Link href={`/legal/${policy.slug}`} className={s.policyCard} key={policy.id}><span className={s.cardNumber}>{String(index + 1).padStart(2, '0')} · {policy.version}</span><h3>{policy.title[language]}</h3><p>{policy.summary[language]}</p><span className={s.cardLink}>{ar ? 'عرض المسودة ←' : 'Open draft →'}</span></Link>)}</div>
      </div>
    </main>
  </LegalShell>;
}

export function LegalDocument({ policy }: { policy: LegalPolicy }) {
  const { language } = useI18n();
  const ar = language === 'ar';
  const related = policy.related.map(slug => LEGAL_POLICIES.find(item => item.slug === slug)).filter((item): item is LegalPolicy => Boolean(item));
  return <LegalShell>
    <main id="legal-main">
      <section className={s.hero}><div className={s.container}><span className={s.eyebrow}>{ar ? 'مسودة سياسة' : 'Policy draft'}</span><h1>{policy.title[language]}</h1><p className={s.heroLead}>{policy.summary[language]}</p><div className={s.heroMeta}><span className={s.pill}>{ar ? `المعرف: ${policy.id}` : `ID: ${policy.id}`}</span><span className={s.pill}>{ar ? `الإصدار: ${policy.version}` : `Version: ${policy.version}`}</span><span className={s.pill}>{ar ? `آخر تحديث: ${policy.lastUpdated}` : `Last updated: ${policy.lastUpdated}`}</span><span className={s.pill}>{policy.effectiveDate[language]}</span></div></div></section>
      <div className={`${s.container} ${s.main}`}><Link className={s.backLink} href="/legal">{ar ? '← جميع السياسات' : '← All policies'}</Link><div className={s.policyLayout}>
        <aside className={s.sidebar}><strong>{ar ? 'في هذه الوثيقة' : 'In this document'}</strong><nav aria-label={ar ? 'أقسام الوثيقة' : 'Document sections'}>{policy.sections.map(item => <a key={item.id} href={`#${item.id}`}>{item.title[language]}</a>)}</nav></aside>
        <article className={s.content}>
          <div className={s.policyIntro}><div><h2>{ar ? 'الغرض' : 'Purpose'}</h2><p>{policy.purpose[language]}</p></div><div><h2>{ar ? 'النطاق' : 'Scope'}</h2><p>{policy.scope[language]}</p></div></div>
          {policy.sections.map(item => <section className={s.policySection} id={item.id} key={item.id}><h2>{item.title[language]}</h2>{item.paragraphs.map((paragraph, index) => <p key={index}>{paragraph[language]}</p>)}{item.bullets && <ul>{item.bullets.map((bullet, index) => <li key={index}>{bullet[language]}</li>)}</ul>}</section>)}
          <section className={s.related}><h2>{ar ? 'سياسات ذات صلة' : 'Related policies'}</h2><div className={s.relatedLinks}>{related.map(item => <Link href={`/legal/${item.slug}`} key={item.id}>{item.title[language]}</Link>)}</div></section>
        </article>
      </div></div>
    </main>
  </LegalShell>;
}
