"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CreditCard,
  Globe2,
  LifeBuoy,
  PlugZap,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  getAuditActionLabel,
  getEntityTypeLabel,
} from "@/lib/i18n/auditLabels";

type Organization = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  members: number;
};
type Audit = {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  actor: { name: string } | null;
};

export function PlatformSuperAdminDashboard({
  stats,
  organizations,
  audit,
}: {
  stats: {
    organizations: number;
    activeOrganizations: number;
    activeUsers: number;
    integrations: number;
    openTickets: number;
    auditEvents: number;
  };
  organizations: Organization[];
  audit: Audit[];
}) {
  const { language } = useI18n();
  const ar = language === "ar";
  const c = ar
    ? {
        eyebrow: "إدارة المنصة بالكامل",
        title: "مسؤول المنصة",
        subtitle:
          "مركز التحكم المركزي لكل الشركات والمستخدمين والخطط والتكاملات وصحة المنصة.",
        healthy: "المنصة تعمل بشكل طبيعي",
        workspaces: "كل الشركات",
        active: "شركات نشطة",
        users: "مستخدمون نشطون",
        integrations: "تكاملات نشطة",
        audit: "أحداث التدقيق",
        recent: "آخر الشركات",
        view: "عرض الكل",
        security: "الأمان والتدقيق",
        sections: "مراكز التحكم",
        members: "أعضاء",
        manage: "إدارة",
        activeStatus: "نشطة",
        inactiveStatus: "موقوفة",
      }
    : {
        eyebrow: "FULL PLATFORM CONTROL",
        title: "Platform Admin",
        subtitle:
          "The central command center for every organization, user, plan, integration, and system signal.",
        healthy: "Platform operational",
        workspaces: "All organizations",
        active: "Active organizations",
        users: "Active users",
        integrations: "Connected integrations",
        audit: "Audit events",
        recent: "Recent organizations",
        view: "View all",
        security: "Security & audit",
        sections: "Control centers",
        members: "members",
        manage: "Manage",
        activeStatus: "Active",
        inactiveStatus: "Inactive",
      };
  const date = (value: string) =>
    new Intl.DateTimeFormat(ar ? "ar-JO" : "en-US", {
      dateStyle: "medium",
    }).format(new Date(value));
  const cards = [
    [
      c.workspaces,
      stats.organizations,
      Building2,
      "text-violet-600 bg-violet-500/10",
    ],
    [
      c.active,
      stats.activeOrganizations,
      Globe2,
      "text-emerald-600 bg-emerald-500/10",
    ],
    [c.users, stats.activeUsers, Users, "text-blue-600 bg-blue-500/10"],
    [
      c.integrations,
      stats.integrations,
      PlugZap,
      "text-cyan-600 bg-cyan-500/10",
    ],
  ] as const;
  const viewOnlyActions = new Set([
    "/admin/platform/signups",
    "/admin/platform/integrations",
    "/admin/platform/health",
    "/admin/platform/analytics",
  ]);
  const actions = [
    [
      "/admin/platform/organizations",
      c.workspaces,
      ar
        ? "كل الشركات وحالتها وخططها وأعضاؤها"
        : "Every organization, status, plan, and member count",
      Building2,
    ],
    [
      "/admin/platform/signups",
      ar ? "التسجيلات وبدء الاستخدام" : "Signups & onboarding",
      ar
        ? "راقب الشركات الجديدة ونقاط التعثر"
        : "Monitor new organizations and activation gaps",
      Users,
    ],
    [
      "/admin/platform/billing",
      ar ? "الخطط والفوترة" : "Plans & billing",
      ar ? "الخطط والتجارب والاستخدام" : "Plans, trials, and usage",
      CreditCard,
    ],
    [
      "/admin/platform/upgrade-requests",
      ar ? "طلبات ترقية الخطط" : "Plan upgrade requests",
      ar
        ? "مراجعة الطلبات والموافقة أو الرفض"
        : "Review, approve, or reject upgrade requests",
      CreditCard,
    ],
    [
      "/admin/platform/integrations",
      c.integrations,
      ar
        ? "حالة ربط Google وMicrosoft وSMTP"
        : "Google, Microsoft, and SMTP status",
      PlugZap,
    ],
    [
      "/admin/platform/health",
      ar ? "صحة المنصة" : "Platform health",
      ar ? "الخدمات والأخطاء والمزامنة" : "Services, errors, and sync",
      Activity,
    ],
    [
      "/admin/platform/support",
      ar ? "الدعم والمشاكل" : "Support & issues",
      ar ? "المشاكل وطلبات المساعدة" : "Issues and help requests",
      LifeBuoy,
    ],
    [
      "/admin/platform/analytics",
      ar ? "تحليلات المنصة" : "Platform analytics",
      ar ? "النمو والاستخدام والاحتفاظ" : "Growth, usage, and retention",
      BarChart3,
    ],
    [
      "/admin/platform/settings",
      ar ? "الإعدادات العامة" : "Global settings",
      ar ? "إعدادات المنصة بالكامل" : "Platform-wide configuration",
      ShieldCheck,
    ],
  ] as const;
  return (
    <div className="space-y-6 pb-10" dir={ar ? "rtl" : "ltr"}>
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-8 text-white shadow-2xl sm:px-10 sm:py-10">
        <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 text-[11px] font-bold tracking-[.25em] text-cyan-300">
              {c.eyebrow}
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
              {c.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {c.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            </span>
            <span>
              <span className="block text-sm font-bold">{c.healthy}</span>
              <span className="text-xs text-slate-400">
                {stats.auditEvents} {c.audit}
              </span>
            </span>
          </div>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(([label, value, Icon, tone]) => (
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
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {c.sections}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{c.subtitle}</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-violet-500" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map(([href, label, description, Icon]) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg dark:border-slate-800 dark:hover:border-violet-700"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                  <Icon className="h-4 w-4" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-violet-500" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-slate-800 dark:text-slate-100">
                {label}
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {description}
              </p>
              <span className="mt-3 block text-[11px] font-bold text-violet-600">
                {viewOnlyActions.has(href)
                  ? ar
                    ? "عرض"
                    : "View"
                  : c.manage} →
              </span>
            </Link>
          ))}
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {c.recent}
            </h2>
            <Link
              href="/admin/platform/organizations"
              className="text-xs font-bold text-violet-600 hover:underline"
            >
              {c.view}
            </Link>
          </div>
          <div className="space-y-3">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                    {org.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {org.members} {c.members} · {date(org.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-600">
                  {org.isActive ? c.activeStatus : c.inactiveStatus}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {c.security}
            </h2>
            <Link
              href="/admin/audit-logs"
              className="text-xs font-bold text-violet-600 hover:underline"
            >
              {c.view}
            </Link>
          </div>
          {audit.length ? (
            <div className="space-y-3">
              {audit.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm dark:bg-slate-900">
                    <Activity className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-200">
                      {getAuditActionLabel(item.action, language)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.actor?.name || (ar ? "النظام" : "System")} ·{" "}
                      {getEntityTypeLabel(item.entityType, language)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {ar ? "لا توجد أحداث حديثة." : "No recent events."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
