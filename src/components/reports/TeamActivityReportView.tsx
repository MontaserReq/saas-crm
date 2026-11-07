"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownUp, Building2, CheckCircle2, ChevronDown, ChevronUp, FileText, Loader2, Mail, PhoneCall, Plus, Search, Ticket, UserRound, XCircle } from 'lucide-react';
import { exportToPrintableTable } from '@/lib/export';
import { useI18n } from '@/lib/i18n/context';
import { exportTeamActivityReportAction, getTeamActivityReportAction } from '@/server/actions/teamActivityReport';
import type { TeamActivityMember, TeamActivityOperation, TeamActivityReport } from '@/server/services/TeamActivityReportService';

type Props = { initialReport: TeamActivityReport; canExport: boolean };

const number = (value: number, language: string) => new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US').format(value);

function operationLabel(operation: TeamActivityOperation, ar: boolean) {
  if (ar) return operation.label;
  return ({ ticket: 'Ticket created', school: 'School added', note: 'Note added', communication: 'Communication', assignment: 'Distribution or transfer', ticket_update: 'Ticket update' } as const)[operation.kind];
}

function statItems(member: TeamActivityMember, ar: boolean) {
  return [
    [ar ? 'تذاكر أنشأها' : 'Tickets created', member.stats.ticketsCreated, Ticket],
    [ar ? 'مدارس أضافها' : 'Schools added', member.stats.schoolsAdded, Building2],
    [ar ? 'ملاحظات أضافها' : 'Notes added', member.stats.notesAdded, FileText],
    [ar ? 'عمليات التواصل' : 'Communications', member.stats.communications, PhoneCall],
    [ar ? 'التوزيعات والتحويلات' : 'Distributions / transfers', member.stats.assignments, ArrowDownUp],
    [ar ? 'تحديثات التذاكر' : 'Ticket updates', member.stats.ticketUpdates, Activity],
  ] as const;
}

function exportRows(report: TeamActivityReport, ar: boolean) {
  const rows: Record<string, string | number>[] = [];
  for (const member of report.members) {
    const base = {
      employee: member.name,
      department: member.department,
      email: member.email,
      status: member.status === 'WORKED' ? (ar ? 'عمل اليوم' : 'Worked today') : (ar ? 'لم يسجل نشاط' : 'No activity recorded'),
      tickets: member.stats.ticketsCreated,
      schools: member.stats.schoolsAdded,
      notes: member.stats.notesAdded,
      communications: member.stats.communications,
      assignments: member.stats.assignments,
      updates: member.stats.ticketUpdates,
      total: member.stats.total,
    };
    if (!member.operations.length) {
      rows.push({ ...base, operation: ar ? 'لم يسجل نشاط' : 'No activity recorded', details: '' });
      continue;
    }
    member.operations.forEach((operation) => rows.push({
      ...base,
      operation: operationLabel(operation, ar),
      details: [operation.ticketNumber, operation.ticketSubject, operation.schoolName, operation.detail].filter(Boolean).join(' · '),
    }));
  }
  return rows;
}

export function TeamActivityReportView({ initialReport, canExport }: Props) {
  const { language } = useI18n();
  const ar = language === 'ar';
  const [date, setDate] = useState(initialReport.date);
  const [employeeId, setEmployeeId] = useState('');
  const [search, setSearch] = useState('');
  const [report, setReport] = useState(initialReport);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      const result = await getTeamActivityReportAction({ date, userId: employeeId || undefined, search: search || undefined });
      if (result.success) setReport(result.report);
      else setError(result.error);
      setLoading(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [date, employeeId, search]);

  const employeeOptions = useMemo(() => initialReport.members.length > 0 ? initialReport.members : report.members, [initialReport.members, report.members]);
  const selectedEmployeeName = employeeOptions.find((member) => member.id === employeeId)?.name || (ar ? 'كل الموظفين' : 'All employees');

  async function handleExport() {
    if (!canExport || exporting) return;
    setExporting(true);
    setError(null);
    const result = await exportTeamActivityReportAction({ date, userId: employeeId || undefined, search: search || undefined });
    if (!result.success) {
      setError(result.error);
      setExporting(false);
      return;
    }
    const rows = exportRows(result.report, ar);
    const headers = [
      { key: 'employee', label: ar ? 'الموظف' : 'Employee' },
      { key: 'department', label: ar ? 'القسم' : 'Department' },
      { key: 'email', label: ar ? 'البريد الإلكتروني' : 'Email' },
      { key: 'status', label: ar ? 'الحالة' : 'Status' },
      { key: 'tickets', label: ar ? 'التذاكر' : 'Tickets' },
      { key: 'schools', label: ar ? 'المدارس' : 'Schools' },
      { key: 'notes', label: ar ? 'الملاحظات' : 'Notes' },
      { key: 'communications', label: ar ? 'التواصل' : 'Communications' },
      { key: 'assignments', label: ar ? 'التوزيعات والتحويلات' : 'Distributions / transfers' },
      { key: 'updates', label: ar ? 'تحديثات التذاكر' : 'Ticket updates' },
      { key: 'total', label: ar ? 'الإجمالي' : 'Total' },
      { key: 'operation', label: ar ? 'نوع العملية' : 'Operation' },
      { key: 'details', label: ar ? 'تفاصيل النشاط' : 'Activity details' },
    ];
    exportToPrintableTable({
      filename: `تقرير-نشاط-الفريق-${result.report.date}`,
      title: ar ? 'تقرير نشاط الفريق' : 'Team activity report',
      rows,
      headers,
      filters: { [ar ? 'التاريخ' : 'Date']: result.report.date, [ar ? 'الموظف' : 'Employee']: employeeId ? selectedEmployeeName : (ar ? 'كل الموظفين' : 'All employees'), ...(search ? { [ar ? 'البحث' : 'Search']: search } : {}) },
      direction: ar ? 'rtl' : 'ltr',
      meta: { sheetName: ar ? 'معلومات التقرير' : 'Report info', generatedAt: ar ? 'تاريخ الإنشاء' : 'Generated at', recordsCount: ar ? 'عدد الموظفين' : 'Employees', filters: ar ? 'الفلاتر' : 'Filters', allRecords: ar ? 'كل السجلات' : 'All records' },
    });
    setExporting(false);
  }

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-5">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><Activity className="h-3.5 w-3.5" />{ar ? 'قراءة تلقائية من سجلات النظام' : 'Automatically calculated from system records'}</div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{ar ? 'تقرير نشاط الفريق' : 'Team activity report'}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{ar ? 'ملخص يومي لنشاط الموظفين النشطين، مع إبقاء الموظفين الذين لم يسجلوا أي نشاط ظاهرين في التقرير.' : 'A daily read-only view of active employees, including team members with no recorded activity.'}</p>
        </div>
        {canExport && <button type="button" onClick={handleExport} disabled={exporting || loading || report.members.length === 0} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"><FileText className="h-4 w-4" />{exporting ? (ar ? 'جارٍ تجهيز PDF...' : 'Preparing PDF...') : (ar ? 'تصدير التقرير PDF' : 'Export report PDF')}</button>}
      </div>

      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[180px_minmax(180px,240px)_1fr_auto] md:items-end">
        <label className="space-y-1.5 text-xs font-bold text-slate-600 dark:text-slate-300"><span>{ar ? 'التاريخ' : 'Date'}</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" /></label>
        <label className="space-y-1.5 text-xs font-bold text-slate-600 dark:text-slate-300"><span>{ar ? 'الموظف' : 'Employee'}</span><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"><option value="">{ar ? 'كل الموظفين' : 'All employees'}</option>{employeeOptions.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
        <label className="space-y-1.5 text-xs font-bold text-slate-600 dark:text-slate-300"><span>{ar ? 'البحث باسم الموظف أو تفاصيل النشاط' : 'Search employee or activity details'}</span><div className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={ar ? 'رقم التذكرة، المدرسة، الملاحظة...' : 'Ticket, school, note...'} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-9 pe-3 text-sm font-semibold text-slate-800 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" /></div></label>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-500" />{report.date} · {report.timezone}</div>
      </div>

      {error && <div role="alert" className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"><XCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {loading && <div className="flex items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700 dark:border-brand-900/60 dark:bg-brand-950/30 dark:text-brand-300"><Loader2 className="h-4 w-4 animate-spin" />{ar ? 'جارٍ تحديث التقرير...' : 'Updating report...'}</div>}

      {!loading && report.members.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900"><UserRound className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" /><h2 className="mt-3 text-lg font-black text-slate-800 dark:text-slate-100">{ar ? 'لا توجد نتائج' : 'No results'}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{ar ? 'جرّب تغيير التاريخ أو الفلاتر الحالية.' : 'Try changing the date or current filters.'}</p></div> : <div className="space-y-4">{report.members.map((member) => <MemberCard key={member.id} member={member} ar={ar} expanded={!!expanded[member.id]} onToggle={() => setExpanded((current) => ({ ...current, [member.id]: !current[member.id] }))} />)}</div>}
    </div>
  );
}

function MemberCard({ member, ar, expanded, onToggle }: { member: TeamActivityMember; ar: boolean; expanded: boolean; onToggle: () => void }) {
  const visibleOperations = expanded ? member.operations : member.operations.slice(0, 8);
  const remaining = Math.max(0, member.operations.length - 8);
  return <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="border-b border-slate-100 p-4 dark:border-slate-800 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"><UserRound className="h-5 w-5" /></span><div className="min-w-0"><h2 className="truncate text-base font-black text-slate-900 dark:text-white">{member.name}</h2><p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{member.department} · {member.email}</p><span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${member.status === 'WORKED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{member.status === 'WORKED' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{member.status === 'WORKED' ? (ar ? 'عمل اليوم' : 'Worked today') : (ar ? 'لم يسجل نشاط' : 'No activity recorded')}</span></div></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{statItems(member, ar).map(([label, value, Icon]) => <div key={label} className="min-w-0 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70"><div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400"><Icon className="h-3.5 w-3.5 shrink-0 text-brand-500" /><span className="truncate">{label}</span></div><strong className="mt-1 block text-lg font-black text-slate-900 dark:text-white">{number(value, ar ? 'ar' : 'en')}</strong></div>)}</div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50/70 px-3 py-2.5 dark:bg-brand-950/20"><span className="text-sm font-black text-brand-800 dark:text-brand-200">{ar ? 'إجمالي النشاط' : 'Total activity'}: {number(member.stats.total, ar ? 'ar' : 'en')}</span><span className="text-xs font-bold text-slate-500 dark:text-slate-400">{member.operations.length} {ar ? 'عملية مسجلة' : 'recorded operations'}</span></div>
    </div>
    <div className="p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100"><Activity className="h-4 w-4 text-brand-500" />{ar ? 'تفاصيل النشاط' : 'Activity details'}</h3>{remaining > 0 && <button type="button" onClick={onToggle} className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-black text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/30">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{expanded ? (ar ? 'إخفاء العمليات الإضافية' : 'Hide extra operations') : `+ ${number(remaining, ar ? 'ar' : 'en')} ${ar ? 'عمليات إضافية' : 'more operations'}`}</button>}</div>{member.operations.length === 0 ? <p className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm font-semibold text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">{ar ? 'لم يسجل نشاط' : 'No activity recorded'}</p> : <div className="space-y-2">{visibleOperations.map((operation) => <div key={operation.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 px-3 py-3 dark:border-slate-800"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{operation.kind === 'communication' ? <PhoneCall className="h-4 w-4" /> : operation.kind === 'school' ? <Building2 className="h-4 w-4" /> : operation.kind === 'assignment' ? <ArrowDownUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-black text-slate-800 dark:text-slate-100">{operationLabel(operation, ar)}</p><time className="text-[11px] font-semibold text-slate-400" dateTime={operation.occurredAt}>{new Date(operation.occurredAt).toLocaleTimeString(ar ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</time></div><p className="mt-1 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{[operation.ticketNumber, operation.ticketSubject, operation.schoolName, operation.detail].filter(Boolean).join(' · ')}</p></div></div>)}</div>}</div>
  </article>;
}
