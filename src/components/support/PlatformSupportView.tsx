'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Headphones,
  LifeBuoy,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { createPlatformSupportRequestAction } from '@/server/actions/platform-support';
import { usePlanSubmission } from '@/components/settings/usePlanSubmission';

type SupportCase = {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  resolution: string;
  contactEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

function statusMeta(status: string, ar: boolean) {
  const values: Record<string, { label: string; tone: string; icon: typeof Clock3 }> = {
    OPEN: { label: ar ? 'مفتوح' : 'Open', tone: 'amber', icon: Clock3 },
    IN_PROGRESS: { label: ar ? 'قيد المتابعة' : 'In progress', tone: 'blue', icon: Headphones },
    RESOLVED: { label: ar ? 'تم الحل' : 'Resolved', tone: 'emerald', icon: CheckCircle2 },
    CLOSED: { label: ar ? 'مغلق' : 'Closed', tone: 'slate', icon: XCircle },
  };
  return values[status] ?? values.OPEN;
}

function priorityMeta(priority: string, ar: boolean) {
  const values: Record<string, { label: string; tone: string }> = {
    LOW: { label: ar ? 'منخفضة' : 'Low', tone: 'slate' },
    NORMAL: { label: ar ? 'عادية' : 'Normal', tone: 'blue' },
    HIGH: { label: ar ? 'مرتفعة' : 'High', tone: 'amber' },
    URGENT: { label: ar ? 'عاجلة' : 'Urgent', tone: 'rose' },
  };
  return values[priority] ?? values.NORMAL;
}

function toneClasses(tone: string) {
  const tones: Record<string, string> = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200',
    blue: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200',
    rose: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200',
    slate: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200',
  };
  return tones[tone] ?? tones.slate;
}

function formatDate(value: string, ar: boolean) {
  return new Intl.DateTimeFormat(ar ? 'ar-JO' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function PlatformSupportView({ data }: { data: { organization: { id: string; name: string }; cases: SupportCase[] } }) {
  const { language } = useI18n();
  const ar = language === 'ar';
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = usePlanSubmission(() => setError(ar ? 'تعذر إرسال الطلب. حاول مرة أخرى.' : 'Unable to send the request. Please try again.'));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    startTransition(async () => {
      const result = await createPlatformSupportRequestAction({ subject, description, priority });
      if (result.success) {
        setSubject('');
        setDescription('');
        setPriority('NORMAL');
        setMessage(ar ? 'تم إرسال طلبك إلى مدير المنصة بنجاح.' : 'Your request was sent to the platform administrator.');
        router.refresh();
      } else {
        setError(result.error === 'INVALID_INPUT' ? (ar ? 'أدخل عنوانًا ووصفًا واضحين للطلب.' : 'Enter a clear subject and description.') : (ar ? 'تعذر إرسال الطلب. حاول مرة أخرى.' : 'Unable to send the request. Please try again.'));
      }
    });
  };

  return <div className="space-y-6 pb-10" dir={ar ? 'rtl' : 'ltr'}>
    <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-9 sm:py-10">
      <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
      <div className="absolute -bottom-28 right-10 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-bold tracking-[.22em] text-cyan-300">{ar ? 'تواصل مباشر مع فريق المنصة' : 'DIRECT PLATFORM SUPPORT'}</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{ar ? 'دعم المنصة' : 'Platform support'}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{ar ? `أرسل مشكلة أو طلبًا خاصًا بـ ${data.organization.name} وسيتابعه مدير المنصة من مركز الدعم.` : `Send an issue or request for ${data.organization.name}. The platform administrator will follow it from the support center.`}</p>
        </div>
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200"><LifeBuoy className="h-7 w-7" /></span>
      </div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
      <section className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300"><MessageSquareText className="h-5 w-5" /></span>
          <div><h2 className="text-xl font-black text-slate-950 dark:text-white">{ar ? 'فتح طلب جديد' : 'Open a new request'}</h2><p className="mt-1 text-sm text-slate-500">{ar ? 'اكتب التفاصيل ليسهل على فريق المنصة فهم الطلب ومتابعته.' : 'Share enough detail so the platform team can act quickly.'}</p></div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">{ar ? 'عنوان الطلب' : 'Request subject'}<input required minLength={3} maxLength={200} value={subject} onChange={event => setSubject(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-violet-500 dark:border-slate-700" placeholder={ar ? 'مثال: مشكلة في تفعيل التكامل' : 'Example: Integration activation issue'} /></label>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">{ar ? 'الأولوية' : 'Priority'}<select value={priority} onChange={event => setPriority(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900"><option value="LOW">{ar ? 'منخفضة — لا يوجد استعجال' : 'Low — no urgency'}</option><option value="NORMAL">{ar ? 'عادية — متابعة اعتيادية' : 'Normal — standard follow-up'}</option><option value="HIGH">{ar ? 'مرتفعة — تؤثر على العمل' : 'High — affects operations'}</option><option value="URGENT">{ar ? 'عاجلة — توقف العمل' : 'Urgent — blocks operations'}</option></select></label>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">{ar ? 'التفاصيل' : 'Details'}<textarea required minLength={10} maxLength={4000} value={description} onChange={event => setDescription(event.target.value)} className="mt-2 min-h-36 w-full resize-y rounded-xl border border-slate-300 bg-transparent px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-violet-500 dark:border-slate-700" placeholder={ar ? 'اشرح المشكلة أو الطلب، وما الذي تتوقعه من فريق المنصة…' : 'Describe the issue or request and what you need from the platform team…'} /></label>
          <div className="flex flex-wrap items-center justify-end gap-3 pt-1"><button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700 disabled:opacity-50"><Send className="h-4 w-4" />{pending ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : ar ? 'إرسال إلى مدير المنصة' : 'Send to platform admin'}</button></div>
          {message && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</p>}
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
        </form>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="mb-5 flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="text-xl font-black text-slate-950 dark:text-white">{ar ? 'كيف تتم المتابعة؟' : 'How follow-up works'}</h2><p className="mt-1 text-sm text-slate-500">{ar ? 'كل طلب يبقى محفوظًا ويمكنك متابعة حالته هنا.' : 'Every request is saved and its status remains visible here.'}</p></div></div>
        <div className="space-y-3"><div className="flex gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"><Clock3 className="h-4 w-4" /></span><p className="text-sm leading-6 text-slate-600 dark:text-slate-300"><b>{ar ? 'مفتوح:' : 'Open:'}</b> {ar ? 'تم استلام الطلب وينتظر المراجعة.' : 'The request was received and awaits review.'}</p></div><div className="flex gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"><Headphones className="h-4 w-4" /></span><p className="text-sm leading-6 text-slate-600 dark:text-slate-300"><b>{ar ? 'قيد المتابعة:' : 'In progress:'}</b> {ar ? 'يعمل فريق المنصة على الطلب.' : 'The platform team is working on it.'}</p></div><div className="flex gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"><CheckCircle2 className="h-4 w-4" /></span><p className="text-sm leading-6 text-slate-600 dark:text-slate-300"><b>{ar ? 'تم الحل:' : 'Resolved:'}</b> {ar ? 'أضاف مدير المنصة نتيجة المعالجة.' : 'The platform administrator added the resolution.'}</p></div></div>
        <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/60 p-4 text-sm leading-6 text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-200"><Sparkles className="mb-1 inline h-4 w-4" /> {ar ? 'للطلبات العاجلة، وضّح في التفاصيل كيف تؤثر المشكلة على تشغيل الشركة.' : 'For urgent requests, explain how the issue is affecting company operations.'}</div>
      </section>
    </div>

    <section className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950 dark:text-white">{ar ? 'طلبات شركتك' : 'Your company requests'}</h2><p className="mt-1 text-sm text-slate-500">{data.cases.length} {ar ? 'طلبًا محفوظًا' : data.cases.length === 1 ? 'saved request' : 'saved requests'}</p></div><AlertCircle className="h-5 w-5 text-violet-500" /></div>
      {data.cases.length ? <div className="space-y-3">{data.cases.map(item => { const status = statusMeta(item.status, ar); const priorityInfo = priorityMeta(item.priority, ar); const StatusIcon = status.icon; return <article key={item.id} className="rounded-2xl border border-slate-200/80 p-4 dark:border-slate-800"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black text-slate-900 dark:text-white">{item.subject}</h3><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-bold ${toneClasses(status.tone)}`}><StatusIcon className="h-3 w-3" />{status.label}</span></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{item.description}</p></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneClasses(priorityInfo.tone)}`}>{ar ? 'أولوية' : 'Priority'}: {priorityInfo.label}</span></div><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800"><span>{formatDate(item.createdAt, ar)}</span>{item.resolution && <span className="font-semibold text-emerald-700 dark:text-emerald-300">{ar ? 'الحل:' : 'Resolution:'} {item.resolution}</span>}</div></article>; })}</div> : <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700"><Headphones className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">{ar ? 'لا توجد طلبات دعم بعد' : 'No support requests yet'}</p><p className="mt-1 text-xs text-slate-500">{ar ? 'أرسل أول طلب من النموذج أعلاه.' : 'Send your first request using the form above.'}</p></div>}
    </section>
  </div>;
}
