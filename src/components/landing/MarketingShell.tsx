'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, Menu, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { faqCopy, landingCopy } from './content';
import s from './marketing.module.css';

// Existing published company contact, also used in the proposal PDF footer.
export const SALES_HREF = 'mailto:info@codeline.jo?subject=CodeLine%20Enterprise%20inquiry';

export function MarketingShell({ children, pricing = false }: { children: React.ReactNode; pricing?: boolean }) {
  const { language } = useI18n();
  const ar = language === 'ar';
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const nav = ar ? ['الإمكانات', 'طريقة العمل', 'الباقات', 'الأسئلة'] : ['Capabilities', 'How it works', 'Pricing', 'FAQ'];
  const urls = pricing ? ['/#features', '/#workflow', '#pricing', '#faq'] : ['#features', '#workflow', '#pricing', '#faq'];
  useEffect(() => {
    if (!open) return;
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { setOpen(false); toggle.current?.focus(); } }
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);
  return <div className={s.site} dir={ar ? 'rtl' : 'ltr'}>
    <a className={s.skipLink} href="#main-content">{ar ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>
    <header className={s.header}><div className={`${s.container} ${s.headerInner}`}>
      <Link href="/" className={s.logo} aria-label="SatrCRM"><BrandLogo className={s.logoImage} priority /></Link>
      <nav className={s.desktopNav} aria-label={ar ? 'التنقل الرئيسي' : 'Main navigation'}>{nav.map((label, i) => <a key={label} href={urls[i]}>{label}</a>)}</nav>
      <div className={s.headerTools}><LanguageSwitcher /><ThemeToggle /><Link className={s.login} href="/login">{ar ? 'تسجيل الدخول' : 'Log in'}</Link><Link className={`${s.primary} ${s.headerCta}`} href="/onboarding">{landingCopy[language].start}</Link></div>
      <button ref={toggle} className={s.menuButton} aria-expanded={open} aria-controls="marketing-mobile-nav" aria-label={open ? (ar ? 'إغلاق القائمة' : 'Close menu') : (ar ? 'فتح القائمة' : 'Open menu')} onClick={() => setOpen(!open)}>{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
    </div>
    <nav id="marketing-mobile-nav" className={s.mobileNav} hidden={!open} aria-label={ar ? 'التنقل للجوال' : 'Mobile navigation'}>{nav.map((label, i) => <a key={label} href={urls[i]} onClick={() => setOpen(false)}>{label}</a>)}<Link href="/login" onClick={() => setOpen(false)}>{ar ? 'تسجيل الدخول' : 'Log in'}</Link><Link className={s.primary} href="/onboarding">{landingCopy[language].start}</Link></nav>
    </header>
    <main id="main-content">{children}</main>
    <footer className={s.footer}><div className={`${s.container} ${s.footerGrid}`}><div><Link href="/" className={s.logo} aria-label="SatrCRM"><BrandLogo className={s.logoImage} /></Link><p>{ar ? 'علاقات العملاء والعمل اليومي، في مساحة واحدة.' : 'Customer relationships and daily work, connected.'}</p></div><nav aria-label={ar ? 'روابط التذييل' : 'Footer navigation'}><Link href="/#features">{nav[0]}</Link><Link href="/pricing">{nav[2]}</Link><Link href="/legal">{ar ? 'السياسات القانونية' : 'Legal policies'}</Link><Link href="/login">{ar ? 'تسجيل الدخول' : 'Log in'}</Link><a href={SALES_HREF}>{ar ? 'تواصل معنا' : 'Contact'}</a></nav></div><div className={`${s.container} ${s.footerBottom}`}><span>© {new Date().getUTCFullYear()} SatrCRM</span><span>{ar ? 'العربية والإنجليزية. مصممة لفريقك.' : 'Arabic & English. Built around your team.'}</span></div></footer>
  </div>;
}

export function MarketingFaq() {
  const { language } = useI18n();
  const t = faqCopy[language];
  return <section id="faq" className={s.faqSection} aria-labelledby="faq-title"><div className={`${s.container} ${s.faqGrid}`}><div><span className={s.sectionLabel}>{language === 'ar' ? 'أسئلة شائعة' : 'Frequently asked questions'}</span><h2 id="faq-title">{t.title}</h2><p className={s.bodyLead}>{t.lead}</p><a className={s.textLink} href={SALES_HREF}>{language === 'ar' ? 'تحدث مع فريقنا' : 'Talk to our team'}<ArrowUpRight aria-hidden="true" /></a></div><div className={s.faqList}>{t.items.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></div></section>;
}

export function FinalCta() {
  const { language } = useI18n();
  const ar = language === 'ar';
  return <section className={s.finalCta} aria-labelledby="final-title"><div className={s.container}><div className={s.finalGrid}><div><span className={s.sectionLabel}>{ar ? 'ابدأ بخطوة واضحة' : 'Move forward with clarity'}</span><h2 id="final-title">{ar ? 'مرحلتك التالية من النمو تبدأ هنا.' : 'Your Next Stage of Growth Starts Here.'}</h2><p>{ar ? 'امنح علاقات عملائك وسير عمل فريقك وضوحاً أكبر مع CodeLine CRM.' : 'Bring greater clarity to your customer relationships and team workflows with CodeLine CRM.'}</p></div><div className={s.finalActions}><Link className={s.primary} href="/onboarding">{landingCopy[language].start}<ArrowUpRight aria-hidden="true" /></Link><a className={s.secondary} href={SALES_HREF}>{ar ? 'تواصل مع المبيعات' : 'Contact sales'}</a><span>{ar ? 'للاحتياجات المخصصة، أخبرنا بحجم فريقك.' : 'For custom requirements, tell us about your team.'}</span></div></div></div></section>;
}

