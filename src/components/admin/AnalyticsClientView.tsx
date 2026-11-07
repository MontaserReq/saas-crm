'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n/context';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Building,
  CheckCircle2,
  Clock,
  Layers3,
  PhoneCall,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { ExportDropdown } from '@/components/ui/ExportDropdown';
import { formatDuration, formatNumber } from '@/lib/formatters';
import { formatDate } from '@/lib/utils';
import { MobileCardField } from '@/components/ui/MobileCard';

interface UserTimeStat {
  userId: string;
  name: string;
  email: string;
  department: string;
  totalMinutes: number;
  sessionsCount: number;
  lastLogin: Date | string | null;
  lastLogout: Date | string | null;
  avgSessionMinutes: number;
}

interface AnalyticsData {
  ticketsByDepartment: { name: string; count: number }[];
  ticketsByMember: { name: string; count: number }[];
  communicationByResult: { result: string; count: number }[];
  ticketsByTaskType: { name: string; count: number }[];
  userTimeStats?: UserTimeStat[];
}

interface AnalyticsClientViewProps {
  data: AnalyticsData;
}

function MetricCard({ label, value, detail, icon: Icon, accent }: { label: string; value: string; detail: string; icon: React.ElementType; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-sm">
      <div className={`absolute -end-5 -top-6 h-20 w-20 rounded-full blur-2xl ${accent}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300/70">{label}</span><span className="mt-1 block truncate text-2xl font-black tracking-tight text-white">{value}</span><span className="mt-1 block text-[11px] text-slate-300/75">{detail}</span></div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/10 text-brand-200"><Icon className="h-4 w-4" /></span>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, tone = 'brand' }: { icon: React.ElementType; title: string; subtitle?: string; tone?: 'brand' | 'violet' | 'emerald' | 'amber' }) {
  const toneClasses = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  };
  return <div className="flex items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toneClasses[tone]}`}><Icon className="h-4 w-4" /></span><div className="min-w-0"><h3 className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{title}</h3>{subtitle && <p className="mt-0.5 truncate text-[11px] text-slate-400">{subtitle}</p>}</div></div>;
}

function EmptyState({ label }: { label: string }) { return <p className="py-8 text-center text-xs text-slate-400">{label}</p>; }

export function AnalyticsClientView({ data }: AnalyticsClientViewProps) {
  const { t, language, getStatusLabel } = useI18n();
  const isArabic = language === 'ar';
  const userTimeStats = data.userTimeStats || [];
  const totalSystemMinutes = userTimeStats.reduce((acc, u) => acc + u.totalMinutes, 0);
  const totalSystemSessions = userTimeStats.reduce((acc, u) => acc + u.sessionsCount, 0);
  const totalTickets = data.ticketsByDepartment.reduce((acc, item) => acc + item.count, 0);
  const totalCommunications = data.communicationByResult.reduce((acc, item) => acc + item.count, 0);
  const totalAssignedTickets = data.ticketsByMember.reduce((acc, item) => acc + item.count, 0);
  const averageSession = totalSystemSessions > 0 ? Math.round(totalSystemMinutes / totalSystemSessions) : 0;
  const topDepartment = [...data.ticketsByDepartment].sort((a, b) => b.count - a.count)[0];
  const topMember = [...data.ticketsByMember].sort((a, b) => b.count - a.count)[0];
  const maxDepartment = Math.max(...data.ticketsByDepartment.map((item) => item.count), 1);
  const maxMemberLoad = Math.max(...data.ticketsByMember.map((item) => item.count), 1);
  const maxTime = Math.max(...userTimeStats.map((item) => item.totalMinutes), 1);
  const maxTaskType = Math.max(...data.ticketsByTaskType.map((item) => item.count), 1);
  const totalTaskTypes = data.ticketsByTaskType.reduce((acc, item) => acc + item.count, 0);

  const chartUsers = [...userTimeStats].sort((a, b) => b.totalMinutes - a.totalMinutes).slice(0, 7);
  const chartWidth = 640;
  const chartHeight = 210;
  const chartPoints = chartUsers.map((user, index) => {
    const x = chartUsers.length <= 1 ? chartWidth / 2 : 38 + (index * (chartWidth - 76)) / (chartUsers.length - 1);
    const y = chartHeight - 30 - (user.totalMinutes / maxTime) * 140;
    return { x, y, user };
  });
  const linePath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = chartPoints.length > 0 ? `${linePath} L ${chartPoints[chartPoints.length - 1].x} ${chartHeight - 20} L ${chartPoints[0].x} ${chartHeight - 20} Z` : '';

  const exportColumns = [
    { header: t('admin.analytics.employee'), accessor: (u: UserTimeStat) => u.name },
    { header: t('admin.users.email'), accessor: (u: UserTimeStat) => u.email },
    { header: t('admin.analytics.department'), accessor: (u: UserTimeStat) => u.department },
    { header: t('admin.analytics.totalTimeMin'), accessor: (u: UserTimeStat) => u.totalMinutes },
    { header: t('admin.analytics.sessionsCount'), accessor: (u: UserTimeStat) => u.sessionsCount },
    { header: t('admin.analytics.avgSessionMin'), accessor: (u: UserTimeStat) => u.avgSessionMinutes },
  ];

  const labels = {
    commandCenter: isArabic ? 'مركز قيادة الأداء' : 'Performance command center',
    liveSignals: isArabic ? 'إشارات مباشرة من بيانات النظام' : 'Live signals from your workspace data',
    teamMembers: isArabic ? 'أعضاء نشطون' : 'active members',
    trackedMinutes: isArabic ? 'دقائق عمل مسجلة' : 'tracked work minutes',
    communications: isArabic ? 'محاولات تواصل' : 'communication attempts',
    workload: isArabic ? 'توزيع عبء العمل' : 'Workload distribution',
    workloadSubtitle: isArabic ? 'نظرة سريعة على التذاكر حسب القسم' : 'A quick view of tickets by department',
    teamPulse: isArabic ? 'نبض الفريق' : 'Team activity pulse',
    teamPulseSubtitle: isArabic ? 'الوقت المسجل لكل عضو' : 'Tracked time by team member',
    workMix: isArabic ? 'مزيج العمل' : 'Work mix',
    workMixSubtitle: isArabic ? 'توزيع أنواع التذاكر' : 'Ticket type distribution',
    memberLoad: isArabic ? 'حمل الأعضاء' : 'Member load',
    memberLoadSubtitle: isArabic ? 'التذاكر النشطة حسب العضو' : 'Active tickets by member',
    communication: isArabic ? 'نتائج التواصل' : 'Communication outcomes',
    communicationSubtitle: isArabic ? 'ملخص محاولات الاتصال' : 'Contact attempt summary',
    leader: isArabic ? 'الأعلى نشاطاً' : 'Top performer',
    noData: t('common.noData'),
    sessions: isArabic ? 'جلسات' : 'sessions',
    tickets: isArabic ? 'تذاكر' : 'tickets',
  };

  return (
    <div className="space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 p-5 shadow-xl shadow-slate-200/30 dark:border-slate-800 dark:shadow-none sm:p-7">
        <div className="pointer-events-none absolute -end-24 -top-28 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" /><div className="pointer-events-none absolute -bottom-32 start-1/3 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
            <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-300/20 bg-brand-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-200"><Sparkles className="h-3.5 w-3.5" />{labels.commandCenter}</div><h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{t('admin.analytics.title')}</h2><p className="mt-1.5 max-w-2xl text-xs leading-6 text-slate-300/75 sm:text-sm">{labels.liveSignals}</p></div>
            {userTimeStats.length > 0 && <ExportDropdown filename="system-analytics-sessions" title={t('admin.analytics.title')} data={userTimeStats} columns={exportColumns} />}
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard label={t('admin.analytics.totalWorkTime')} value={formatDuration(totalSystemMinutes, language)} detail={labels.trackedMinutes} icon={Clock} accent="bg-brand-400/40" />
            <MetricCard label={t('admin.analytics.totalSessions')} value={formatNumber(totalSystemSessions, language)} detail={`${formatDuration(averageSession, language)} ${isArabic ? 'متوسط الجلسة' : 'average session'}`} icon={Activity} accent="bg-violet-400/40" />
            <MetricCard label={isArabic ? 'التذاكر المسندة' : 'Assigned tickets'} value={formatNumber(totalAssignedTickets, language)} detail={`${formatNumber(userTimeStats.length, language)} ${labels.teamMembers}`} icon={Target} accent="bg-emerald-400/40" />
            <MetricCard label={isArabic ? 'التواصل' : 'Communications'} value={formatNumber(totalCommunications, language)} detail={labels.communications} icon={PhoneCall} accent="bg-amber-400/40" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><SectionTitle icon={Activity} title={labels.teamPulse} subtitle={labels.teamPulseSubtitle} /><div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />{isArabic ? 'بيانات فعلية' : 'Live data'}</div></div>
          {chartPoints.length > 0 ? <div className="mt-5"><div className="relative h-[235px] overflow-hidden rounded-2xl bg-gradient-to-b from-brand-50/80 to-white dark:from-brand-500/[0.08] dark:to-slate-900"><div className="absolute inset-x-0 top-1/4 border-t border-dashed border-slate-200 dark:border-slate-800" /><div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-200 dark:border-slate-800" /><div className="absolute inset-x-0 top-3/4 border-t border-dashed border-slate-200 dark:border-slate-800" /><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none" role="img" aria-label={labels.teamPulse}><defs><linearGradient id="analyticsArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.32" /><stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" /></linearGradient><filter id="analyticsGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>{areaPath && <path d={areaPath} fill="url(#analyticsArea)" />}{linePath && <path d={linePath} fill="none" stroke="#38bdf8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" filter="url(#analyticsGlow)" />}{chartPoints.map((point) => <circle key={point.user.userId} cx={point.x} cy={point.y} r="5" fill="#0f172a" stroke="#7dd3fc" strokeWidth="3" />)}</svg><div className="absolute inset-x-4 bottom-3 flex justify-between gap-2">{chartUsers.map((user) => <span key={user.userId} className="max-w-[76px] truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">{user.name}</span>)}</div></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{chartUsers.slice(0, 3).map((user, index) => <div key={user.userId} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60"><div className="flex items-center gap-2"><span className={`grid h-6 w-6 place-items-center rounded-lg text-[10px] font-black ${index === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'}`}>{index + 1}</span><span className="truncate text-xs font-bold text-slate-700 dark:text-slate-300">{user.name}</span></div><p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{formatDuration(user.totalMinutes, language)}</p></div>)}</div></div> : <EmptyState label={labels.noData} />}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <SectionTitle icon={Layers3} title={labels.workMix} subtitle={labels.workMixSubtitle} tone="violet" />
          {data.ticketsByTaskType.length > 0 && totalTaskTypes > 0 ? <><div className="mt-6 flex items-center justify-center"><div className="relative grid h-44 w-44 place-items-center rounded-full" style={{ background: `conic-gradient(#0ea5e9 0 ${Math.round(((data.ticketsByTaskType[0]?.count || 0) / totalTaskTypes) * 100)}%, #8b5cf6 0 62%, #10b981 0 82%, #f59e0b 0)` }}><div className="grid h-28 w-28 place-items-center rounded-full bg-white text-center dark:bg-slate-900"><div><span className="block text-2xl font-black text-slate-900 dark:text-white">{formatNumber(totalTaskTypes, language)}</span><span className="text-[10px] font-bold text-slate-400">{labels.tickets}</span></div></div></div></div><div className="mt-6 space-y-2.5">{data.ticketsByTaskType.slice(0, 5).map((item, index) => <div key={item.name} className="flex items-center justify-between gap-3 text-xs"><div className="flex min-w-0 items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${['bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'][index]}`} /><span className="truncate font-semibold text-slate-600 dark:text-slate-300">{item.name}</span></div><span className="shrink-0 font-black text-slate-900 dark:text-white">{formatNumber(item.count, language)} <span className="font-normal text-slate-400">({Math.round((item.count / totalTaskTypes) * 100)}%)</span></span></div>)}</div></> : <EmptyState label={labels.noData} />}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div className="flex items-start justify-between gap-3"><SectionTitle icon={Building} title={labels.workload} subtitle={labels.workloadSubtitle} />{topDepartment && <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{topDepartment.name}</span>}</div><div className="mt-6 space-y-4">{data.ticketsByDepartment.length > 0 ? data.ticketsByDepartment.map((item) => <div key={item.name}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate font-bold text-slate-700 dark:text-slate-300">{item.name}</span><span className="shrink-0 font-black text-slate-900 dark:text-white">{formatNumber(item.count, language)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400 transition-all" style={{ width: `${Math.max(4, (item.count / maxDepartment) * 100)}%` }} /></div></div>) : <EmptyState label={labels.noData} />}</div><div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs dark:border-slate-800"><span className="text-slate-400">{isArabic ? 'إجمالي التذاكر الظاهرة' : 'Total visible tickets'}</span><span className="font-black text-slate-900 dark:text-white">{formatNumber(totalTickets, language)}</span></div></section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"><SectionTitle icon={Users} title={labels.memberLoad} subtitle={labels.memberLoadSubtitle} tone="emerald" /><div className="mt-6 space-y-4">{data.ticketsByMember.length > 0 ? data.ticketsByMember.map((item) => <div key={item.name}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2 font-bold text-slate-700 dark:text-slate-300"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-emerald-50 text-[10px] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">{item.name.slice(0, 1)}</span><span className="truncate">{item.name}</span></span><span className="shrink-0 font-black text-slate-900 dark:text-white">{formatNumber(item.count, language)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all" style={{ width: `${Math.max(4, (item.count / maxMemberLoad) * 100)}%` }} /></div></div>) : <EmptyState label={labels.noData} />}</div>{topMember && <div className="mt-6 flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-xs dark:bg-emerald-500/[0.08]"><Trophy className="h-4 w-4 text-amber-500" /><span className="text-slate-600 dark:text-slate-300">{labels.leader}: <strong className="text-slate-900 dark:text-white">{topMember.name}</strong></span></div>}</section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><SectionTitle icon={PhoneCall} title={labels.communication} subtitle={labels.communicationSubtitle} tone="amber" />{totalCommunications > 0 && <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><Zap className="h-3 w-3" />{formatNumber(totalCommunications, language)} {labels.communications}</span>}</div>{data.communicationByResult.length > 0 ? <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{data.communicationByResult.map((item, index) => { const percentage = totalCommunications > 0 ? Math.round((item.count / totalCommunications) * 100) : 0; return <div key={item.result} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/50"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-bold text-slate-600 dark:text-slate-300">{getStatusLabel(item.result)}</span><span className={`h-2.5 w-2.5 rounded-full ${['bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500'][index % 4]}`} /></div><div className="mt-3 flex items-end justify-between gap-2"><span className="text-2xl font-black text-slate-900 dark:text-white">{formatNumber(item.count, language)}</span><span className="text-xs font-bold text-slate-400">{percentage}%</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.max(5, percentage)}%` }} /></div></div>; })}</div> : <EmptyState label={labels.noData} />}</section>

      {userTimeStats.length > 0 && <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><Clock className="h-4 w-4" /></span><div><h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{t('admin.analytics.timeSpentStats')}</h3><p className="mt-0.5 text-[11px] text-slate-400">{t('admin.analytics.timeSpentSubtitle')}</p></div></div><div className="overflow-x-auto"><table className="w-full border-collapse text-xs text-start"><thead><tr className="hidden border-b border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400 md:table-row"><th className="px-5 py-3 font-bold">{t('admin.analytics.employee')}</th><th className="px-5 py-3 font-bold">{t('admin.analytics.department')}</th><th className="px-5 py-3 font-bold">{t('admin.analytics.totalTime')}</th><th className="px-5 py-3 font-bold">{t('admin.analytics.sessions')}</th><th className="px-5 py-3 font-bold">{t('admin.analytics.avgSession')}</th><th className="px-5 py-3 font-bold">{t('admin.analytics.lastActivity')}</th></tr></thead><tbody>{userTimeStats.map((user) => <React.Fragment key={user.userId}><tr className="hidden border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 md:table-row"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-xs font-black text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{user.name.slice(0, 1)}</span><div><span className="block font-bold text-slate-900 dark:text-slate-100">{user.name}</span><span className="block text-[10px] text-slate-400">{user.email}</span></div></div></td><td className="px-5 py-4 font-medium text-slate-600 dark:text-slate-400">{user.department}</td><td className="px-5 py-4 font-black text-brand-600 dark:text-brand-400">{formatDuration(user.totalMinutes, language)}</td><td className="px-5 py-4 text-slate-700 dark:text-slate-300">{formatNumber(user.sessionsCount, language)}</td><td className="px-5 py-4 text-slate-600 dark:text-slate-400">{formatDuration(user.avgSessionMinutes, language)}</td><td className="px-5 py-4 text-slate-400">{formatDate(user.lastLogin, language)}</td></tr><tr className="border-b border-slate-100 dark:border-slate-800 md:hidden"><td colSpan={6} className="space-y-2 p-4"><div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-xs font-black text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{user.name.slice(0, 1)}</span><div className="min-w-0"><div className="truncate font-bold text-slate-900 dark:text-slate-100">{user.name}</div><div className="truncate text-[10px] text-slate-400">{user.email}</div></div></div><span className="shrink-0 font-black text-brand-600 dark:text-brand-400">{formatDuration(user.totalMinutes, language)}</span></div><MobileCardField label={t('admin.analytics.department')}>{user.department}</MobileCardField><MobileCardField label={t('admin.analytics.sessions')}>{formatNumber(user.sessionsCount, language)}</MobileCardField><MobileCardField label={t('admin.analytics.avgSession')}>{formatDuration(user.avgSessionMinutes, language)}</MobileCardField><MobileCardField label={t('admin.analytics.lastActivity')}>{formatDate(user.lastLogin, language)}</MobileCardField></td></tr></React.Fragment>)}</tbody></table></div></section>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"><SectionTitle icon={BarChart3} title={t('admin.analytics.taskTypeDistribution')} subtitle={isArabic ? 'أكثر أنواع العمل حضوراً' : 'The most visible work types'} tone="violet" /><div className="mt-6 space-y-4">{data.ticketsByTaskType.length > 0 ? data.ticketsByTaskType.map((item) => <div key={item.name}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="truncate font-bold text-slate-700 dark:text-slate-300">{item.name}</span><span className="font-black text-slate-900 dark:text-white">{formatNumber(item.count, language)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400" style={{ width: `${Math.max(5, (item.count / maxTaskType) * 100)}%` }} /></div></div>) : <EmptyState label={labels.noData} />}</div></section><section className="relative overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-violet-50 p-5 shadow-sm dark:border-brand-900/60 dark:from-brand-500/[0.12] dark:via-slate-900 dark:to-violet-500/[0.08] sm:p-6"><div className="pointer-events-none absolute -end-12 -top-12 h-32 w-32 rounded-full bg-brand-400/20 blur-3xl" /><div className="relative"><SectionTitle icon={CheckCircle2} title={isArabic ? 'لقطة تنفيذية' : 'Executive snapshot'} subtitle={isArabic ? 'إشارة سريعة تساعدك على اتخاذ القرار' : 'A quick signal for your next decision'} /><div className="mt-6 space-y-3"><div className="flex items-center gap-3 rounded-2xl bg-white/80 p-3 dark:bg-slate-900/60"><span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"><ArrowUpRight className="h-4 w-4" /></span><p className="text-xs leading-5 text-slate-600 dark:text-slate-300">{topDepartment ? (isArabic ? `القسم الأكثر حملاً حالياً هو ${topDepartment.name} بـ ${topDepartment.count} تذكرة.` : `${topDepartment.name} carries the highest visible load with ${topDepartment.count} tickets.`) : labels.noData}</p></div><div className="flex items-center gap-3 rounded-2xl bg-white/80 p-3 dark:bg-slate-900/60"><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Users className="h-4 w-4" /></span><p className="text-xs leading-5 text-slate-600 dark:text-slate-300">{topMember ? (isArabic ? `${topMember.name} لديه أعلى عدد من التذاكر المسندة (${topMember.count}).` : `${topMember.name} currently has the highest assigned load (${topMember.count}).`) : labels.noData}</p></div><div className="flex items-center gap-3 rounded-2xl bg-white/80 p-3 dark:bg-slate-900/60"><span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Zap className="h-4 w-4" /></span><p className="text-xs leading-5 text-slate-600 dark:text-slate-300">{isArabic ? `${formatNumber(totalCommunications, language)} محاولة تواصل مسجلة ضمن الفترة الحالية.` : `${formatNumber(totalCommunications, language)} communication attempts are recorded in the current data set.`}</p></div></div></div></section></div>
    </div>
  );
}
