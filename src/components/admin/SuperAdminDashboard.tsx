"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import {
  Activity,
  ArrowUpRight,
  BellRing,
  Building2,
  CheckCircle2,
  Database,
  KeyRound,
  Layers3,
  ScrollText,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  getAuditActionLabel,
  getEntityTypeLabel,
} from "@/lib/i18n/auditLabels";

type Props = {
  organization: {
    name: string;
    slug: string;
    isActive: boolean;
    language: string;
  };
  stats: {
    activeMembers: number;
    pendingApprovals: number;
    openTickets: number;
    openTasks: number;
    unreadNotifications: number;
    integrations: number;
  };
  integrations: Array<{
    provider: string;
    accountEmail: string | null;
    updatedAt: string;
  }>;
  recentAudit: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    actor: { name: string } | null;
  }>;
  signups: Array<{
    id: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
  }>;
};

const dateLabel = (value: string, language: string) =>
  new Intl.DateTimeFormat(language === "ar" ? "ar-JO" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function SuperAdminDashboard({
  organization,
  stats,
  recentAudit,
  signups,
}: Props) {
  const { language } = useI18n();
  const ar = language === "ar";
  const copy = ar
    ? {
        eyebrow: "حوكمة المنصة",
        title: "مركز تحكم المدير الأعلى",
        subtitle:
          "صورة تنفيذية سريعة لصحة مساحة العمل، الوصول، الأمان، والإعدادات.",
        healthy: "النظام يعمل بشكل طبيعي",
        activeMembers: "أعضاء نشطون",
        approvals: "موافقات معلّقة",
        openTickets: "تذاكر مفتوحة",
        openTasks: "مهام مفتوحة",
        unread: "تنبيهات غير مقروءة",
        integrations: "ربوط مفعّلة",
        governance: "الحوكمة والوصول",
        operations: "حالة مساحة العمل",
        activity: "آخر نشاط أمني",
        signups: "تسجيلات جديدة",
        noSignups: "لا توجد تسجيلات جديدة تحتاج مراجعة.",
        noActivity: "لا يوجد نشاط مسجل بعد.",
        viewAll: "عرض الكل",
        users: "المستخدمون",
        roles: "الأدوار والصلاحيات",
        audit: "سجل التدقيق",
        approvalsLink: "طلبات الموافقة",
        organization: "إعدادات المؤسسة",
        departments: "الأقسام والهيكل",
      }
    : {
        eyebrow: "PLATFORM GOVERNANCE",
        title: "Super Admin Control Center",
        subtitle:
          "A focused executive view of workspace health, access, security, and configuration.",
        healthy: "All systems operational",
        activeMembers: "Active members",
        approvals: "Pending approvals",
        openTickets: "Open tickets",
        openTasks: "Open tasks",
        unread: "Unread alerts",
        integrations: "Connected integrations",
        governance: "Governance & access",
        operations: "Workspace health",
        activity: "Recent security activity",
        signups: "New signups",
        noSignups: "No new signups need your attention.",
        noActivity: "No activity recorded yet.",
        viewAll: "View all",
        users: "Users",
        roles: "Roles & permissions",
        audit: "Audit log",
        approvalsLink: "Approval requests",
        organization: "Organization settings",
        departments: "Departments & structure",
      };

  const metrics = [
    {
      label: copy.activeMembers,
      value: stats.activeMembers,
      icon: Users,
      tone: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    },
    {
      label: copy.approvals,
      value: stats.pendingApprovals,
      icon: BellRing,
      tone: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    },
    {
      label: copy.openTickets,
      value: stats.openTickets,
      icon: Layers3,
      tone: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    },
    {
      label: copy.integrations,
      value: stats.integrations,
      icon: Database,
      tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    },
  ];
  const actions = [
    {
      href: "/admin/users",
      label: copy.users,
      description: ar
        ? "إدارة أعضاء مساحة العمل وحالاتهم"
        : "Manage workspace members and status",
      icon: Users,
    },
    {
      href: "/admin/roles",
      label: copy.roles,
      description: ar
        ? "ضبط ما يستطيع كل دور الوصول إليه"
        : "Control what each role can access",
      icon: KeyRound,
    },
    {
      href: "/admin/audit-logs",
      label: copy.audit,
      description: ar
        ? "مراجعة الأحداث والعمليات الحساسة"
        : "Review sensitive system activity",
      icon: ScrollText,
    },
    {
      href: "/admin/approval-requests",
      label: copy.approvalsLink,
      description: ar
        ? "مراجعة الطلبات التي تنتظر القرار"
        : "Review requests waiting for a decision",
      icon: BellRing,
    },
    {
      href: "/admin/departments",
      label: copy.departments,
      description: ar ? "تنظيم الهيكل والفرق" : "Organize teams and structure",
      icon: Building2,
    },
    {
      href: "/settings",
      label: copy.organization,
      description: ar
        ? "الهوية، اللغة، والتكاملات"
        : "Identity, language, and integrations",
      icon: Settings2,
    },
  ];

  return (
    <div className="space-y-6 pb-10" dir={ar ? "rtl" : "ltr"}>
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-8 text-white shadow-2xl shadow-slate-900/10 sm:px-10 sm:py-10">
        <div className="absolute -top-24 ltr:-right-16 rtl:-left-16 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute -bottom-28 ltr:-left-10 rtl:-right-10 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 text-[11px] font-bold tracking-[0.25em] text-cyan-300">
              {copy.eyebrow}
            </p>
            <h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {copy.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm backdrop-blur">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            </span>
            <span>
              <span className="block font-semibold">{copy.healthy}</span>
              <span className="text-xs text-slate-400">
                {organization.name}
              </span>
            </span>
          </div>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5"
          >
            <div
              className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {copy.governance}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{copy.subtitle}</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-brand-500" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {actions.map(({ href, label, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:hover:border-brand-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-brand-500" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-800 dark:text-slate-100">
                  {label}
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              </Link>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {copy.operations}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {stats.openTasks} {copy.openTasks.toLowerCase()}
              </p>
            </div>
            <Activity className="h-5 w-5 text-brand-500" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {copy.unread}
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {stats.unreadNotifications}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {copy.integrations}
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {stats.integrations}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {copy.approvals}
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-300">
                {stats.pendingApprovals}
              </span>
            </div>
          </div>
        </section>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {copy.signups}
            </h2>
            <Link
              href="/notifications"
              className="text-xs font-bold text-brand-600 hover:underline"
            >
              {copy.viewAll}
            </Link>
          </div>
          {signups.length ? (
            <div className="space-y-3">
              {signups.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.isRead ? "bg-slate-300" : "bg-brand-500"}`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {item.message}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-400">
                        {dateLabel(item.createdAt, language)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-slate-800/60">
              {copy.noSignups}
            </p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {copy.activity}
            </h2>
            <Link
              href="/admin/audit-logs"
              className="text-xs font-bold text-brand-600 hover:underline"
            >
              {copy.viewAll}
            </Link>
          </div>
          {recentAudit.length ? (
            <div className="space-y-3">
              {recentAudit.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm dark:bg-slate-900">
                    <Activity className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {getAuditActionLabel(item.action, language)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.actor?.name || (ar ? "النظام" : "System")} ·{" "}
                      {getEntityTypeLabel(item.entityType, language)}
                    </p>
                  </div>
                  <time className="hidden text-[11px] text-slate-400 sm:block">
                    {dateLabel(item.createdAt, language)}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-slate-800/60">
              {copy.noActivity}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
