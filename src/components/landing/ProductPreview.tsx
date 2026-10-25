'use client';

import {
  Activity,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  GitBranch,
  LayoutDashboard,
  ListTodo,
  MessageSquareText,
  Plus,
  Search,
  UsersRound,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { BrandLogo } from '@/components/brand/BrandLogo';
import s from './marketing.module.css';

const previewCopy = {
  en: {
    sample: 'Product preview · Sample data',
    workspace: 'CodeLine workspace',
    nav: ['Overview', 'Customers', 'Pipeline', 'Tasks', 'Conversations'],
    dashboard: 'Sales command center',
    dashboardLead: 'Customer relationships and next steps, in one clear view.',
    search: 'Search workspace',
    add: 'Add opportunity',
    metrics: [
      ['Open opportunities', '12', 'Across 3 stages'],
      ['Follow-ups', '7', 'Due today'],
      ['Customer activity', '28', 'Recent touchpoints'],
    ],
    pipeline: 'Sales pipeline',
    pipelineMeta: '12 opportunities · Sample view',
    stages: ['Qualified', 'Proposal', 'Negotiation'],
    deals: [
      ['Annual service', 'Al Noor Co.', 'JOD 8,400', 'LA'],
      ['Team onboarding', 'Horizon Co.', 'JOD 5,200', 'OM'],
      ['Support agreement', 'Atlas Co.', 'JOD 3,600', 'LA'],
    ],
    context: 'Customer context',
    customer: 'Al Noor Co.',
    customerMeta: 'Services · Active account',
    details: [['Contact', 'Rana Ahmad'], ['Owner', 'Lina A.'], ['Next step', 'Proposal review']],
    recent: 'Recent activity',
    activity: ['Proposal linked to account', 'Follow-up task created', 'Meeting note added'],
    activityCard: 'Recent activity',
    activityText: 'Proposal shared with Al Noor Co.',
    activityTime: '12 min ago',
    reminder: 'Follow-up ready',
    reminderText: 'Review customer request',
    reminderTime: 'Today · 2:30 PM',
    note: 'Illustrative preview using synthetic data and supported CRM workflows.',
    taskTitle: 'Today’s follow-ups',
    taskSubtitle: 'Owners, due dates, and customer context.',
    tasks: [['Review customer request', 'Al Noor Co.', 'Lina', 'In progress'], ['Send proposal draft', 'Horizon Co.', 'Omar', 'To do'], ['Schedule review meeting', 'Atlas Co.', 'Lina', 'Completed']],
    deadline: 'Due today',
    relation: 'Linked to the customer record',
  },
  ar: {
    sample: 'معاينة للمنتج · بيانات توضيحية',
    workspace: 'مساحة عمل CodeLine',
    nav: ['نظرة عامة', 'العملاء', 'مسار المبيعات', 'المهام', 'المحادثات'],
    dashboard: 'مركز قيادة المبيعات',
    dashboardLead: 'علاقات العملاء والخطوات التالية في مشهد واحد واضح.',
    search: 'ابحث في مساحة العمل',
    add: 'إضافة فرصة',
    metrics: [
      ['الفرص المفتوحة', '١٢', 'ضمن ٣ مراحل'],
      ['المتابعات', '٧', 'مستحقة اليوم'],
      ['نشاط العملاء', '٢٨', 'تفاعلاً حديثاً'],
    ],
    pipeline: 'مسار المبيعات',
    pipelineMeta: '١٢ فرصة · عرض توضيحي',
    stages: ['مؤهلة', 'عرض سعر', 'تفاوض'],
    deals: [
      ['خدمة سنوية', 'شركة النور', '٨٬٤٠٠ د.أ', 'لن'],
      ['إعداد الفريق', 'شركة الأفق', '٥٬٢٠٠ د.أ', 'عم'],
      ['اتفاقية دعم', 'شركة أطلس', '٣٬٦٠٠ د.أ', 'لن'],
    ],
    context: 'سياق العميل',
    customer: 'شركة النور',
    customerMeta: 'خدمات · حساب نشط',
    details: [['جهة الاتصال', 'رنا أحمد'], ['المسؤولة', 'لينا أ.'], ['الخطوة التالية', 'مراجعة العرض']],
    recent: 'آخر النشاطات',
    activity: ['رُبط العرض بحساب العميل', 'أُنشئت مهمة متابعة', 'أُضيفت ملاحظة اجتماع'],
    activityCard: 'نشاط حديث',
    activityText: 'تمت مشاركة العرض مع شركة النور',
    activityTime: 'قبل ١٢ دقيقة',
    reminder: 'متابعة جاهزة',
    reminderText: 'مراجعة طلب العميل',
    reminderTime: 'اليوم · ٢:٣٠ م',
    note: 'معاينة توضيحية تستخدم بيانات تجريبية ومسارات عمل مدعومة.',
    taskTitle: 'متابعات اليوم',
    taskSubtitle: 'مسؤول وموعد وسياق واضح لكل مهمة.',
    tasks: [['مراجعة طلب العميل', 'شركة النور', 'لينا', 'قيد التنفيذ'], ['إرسال مسودة العرض', 'شركة الأفق', 'عمر', 'لم تبدأ'], ['تحديد اجتماع المراجعة', 'شركة أطلس', 'لينا', 'مكتملة']],
    deadline: 'موعدها اليوم',
    relation: 'مرتبطة بسجل العميل',
  },
} as const;

const navIcons = [LayoutDashboard, UsersRound, GitBranch, ListTodo, MessageSquareText];

export function ProductPreview() {
  const { language } = useI18n();
  const t = previewCopy[language];

  return <figure className={s.productStage}>
    <div className={s.productGlow} aria-hidden="true" />
    <div className={s.productFrame} aria-hidden="true">
      <div className={s.frameTop}>
        <span className={s.frameDots}><i /><i /><i /></span>
        <span>{t.sample}</span>
        <span className={s.frameStatus}><span />CRM</span>
      </div>
      <div className={s.productWindow}>
        <aside className={s.previewSidebar}>
          <span className={s.previewBrand}><BrandLogo variant="symbol" tone="white" className={s.previewBrandImage} /></span>
          <div className={s.previewNav}>{t.nav.map((label, index) => {
            const Icon = navIcons[index];
            return <span key={label} className={index === 0 ? s.previewNavActive : undefined}><Icon /> <small>{label}</small></span>;
          })}</div>
          <span className={s.sidebarAvatar}>LA</span>
        </aside>
        <div className={s.previewApp}>
          <div className={s.dashboardBar}>
            <div><span className={s.dashboardMark}><Building2 /></span><strong>{t.workspace}</strong></div>
            <span className={s.searchField}><Search />{t.search}</span>
            <span className={s.dashboardIcon}><Bell /></span>
            <span className={s.dashboardAvatar}>LA</span>
          </div>
          <div className={s.dashboardCanvas}>
            <div className={s.dashboardIntro}>
              <div><span className={s.dashboardEyebrow}>CRM / {t.nav[0]}</span><h2>{t.dashboard}</h2><p>{t.dashboardLead}</p></div>
              <span className={s.addOpportunity}><Plus />{t.add}</span>
            </div>
            <div className={s.metricGrid}>{t.metrics.map(([label, value, meta], index) => <div className={s.metricCard} key={label}>
              <div className={s.metricTop}><span>{label}</span>{index === 0 ? <GitBranch /> : index === 1 ? <ListTodo /> : <Activity />}</div>
              <strong>{value}</strong><small>{meta}</small>
              <span className={s.metricSpark} data-variant={index}>{[36, 58, 44, 72, 61, 88].map((height, bar) => <i key={bar} style={{ height: `${Math.max(18, height - index * 7)}%` }} />)}</span>
            </div>)}</div>
            <div className={s.dashboardBody}>
              <section className={s.pipelineSurface}>
                <div className={s.previewSectionHead}><div><h3>{t.pipeline}</h3><span>{t.pipelineMeta}</span></div><span className={s.moreDots}>•••</span></div>
                <div className={s.kanban}>{t.stages.map((stage, index) => <div className={s.kanbanColumn} key={stage}>
                  <div className={s.stageLabel}><span /><strong>{stage}</strong><small>{index + 2}</small></div>
                  <article className={s.dealCard}>
                    <div className={s.dealCardTop}><span className={s.dealInitial}>{t.deals[index][1].charAt(0)}</span><span className={s.dealOwner}>{t.deals[index][3]}</span></div>
                    <h4>{t.deals[index][0]}</h4><p>{t.deals[index][1]}</p><strong className={s.dealValue} dir="ltr">{t.deals[index][2]}</strong>
                    <span className={s.dealProgress}><i style={{ width: `${54 + index * 16}%` }} /></span>
                  </article>
                </div>)}</div>
              </section>
              <aside className={s.contextRail}>
                <div className={s.contextHeading}><span className={s.customerLogo}>A</span><div><span>{t.context}</span><strong>{t.customer}</strong><small>{t.customerMeta}</small></div></div>
                <dl>{t.details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                <div className={s.activityList}><h3>{t.recent}</h3>{t.activity.map((item, index) => <div key={item}><span>{index === 0 ? <CheckCircle2 /> : index === 1 ? <ListTodo /> : <CalendarDays />}</span><p>{item}<small>{index === 0 ? t.activityTime : t.reminderTime}</small></p></div>)}</div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div className={`${s.floatingCard} ${s.activityFloat}`} aria-hidden="true"><span className={s.floatIcon}><Activity /></span><div><small>{t.activityCard}</small><strong>{t.activityText}</strong><span>{t.activityTime}</span></div><CheckCircle2 className={s.floatCheck} /></div>
    <div className={`${s.floatingCard} ${s.taskFloat}`} aria-hidden="true"><span className={s.floatIcon}><ListTodo /></span><div><small>{t.reminder}</small><strong>{t.reminderText}</strong><span>{t.reminderTime}</span></div></div>
    <figcaption>{t.note}</figcaption>
  </figure>;
}

function TaskRows() {
  const { language } = useI18n();
  const t = previewCopy[language];
  return <><div className={s.panelTitle}><div><h3>{t.taskTitle}</h3><p>{t.taskSubtitle}</p></div><ListTodo aria-hidden="true" /></div><div className={s.taskRows}>{t.tasks.map(([title, account, owner, status], i) => <div key={title}><span className={s.taskCheck}>{i === 2 ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}</span><div className={s.taskName}><strong>{title}</strong><span>{account} · {owner}</span></div><span className={`${s.status} ${i === 2 ? s.completedStatus : ''}`}>{status}</span></div>)}</div><div className={s.previewBottom}><span>{t.deadline}</span><span>{t.relation}</span></div></>;
}

export function TaskPreview() {
  const { language } = useI18n();
  return <figure className={s.taskPreview}><div className={s.taskPreviewHeader}><span className={s.miniLogo}><BrandLogo variant="symbol" tone="white" className={s.miniLogoImage} /></span><span>{previewCopy[language].sample}</span></div><TaskRows /></figure>;
}
