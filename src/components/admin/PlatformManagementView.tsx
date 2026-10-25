"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  MessageSquareReply,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { Modal } from "@/components/ui/Modal";
import { PlatformRecordForm } from "./PlatformRecordForm";
import { getPlatformResourceAccess } from "@/lib/platform/access";
import type {
  PlatformRecord,
  PlatformResource,
  PlatformSection,
  PlatformSectionData,
} from "@/lib/platform/types";

const names: Record<string, [string, string]> = {
  organizations: ["Organizations", "الشركات"],
  signups: ["Signups & onboarding", "التسجيلات وبدء الاستخدام"],
  users: ["Users & access", "المستخدمون والوصول"],
  billing: ["Plans & subscriptions", "الخطط والاشتراكات"],
  plans: ["Plans", "الخطط"],
  subscriptions: ["Subscriptions", "الاشتراكات"],
  integrations: ["Integrations", "التكاملات"],
  support: ["Platform support", "دعم المنصة"],
  settings: ["Global settings", "الإعدادات العامة"],
  health: ["Platform health", "صحة المنصة"],
  analytics: ["Platform analytics", "تحليلات المنصة"],
};
const columns: Record<PlatformResource, [string, string, string][]> = {
  organizations: [
    ["name", "Workspace", "الشركة"],
    ["slug", "Slug", "الرمز"],
    ["members", "Members", "الأعضاء"],
    ["isActive", "Status", "الحالة"],
    ["onboardingStatus", "Onboarding", "بدء الاستخدام"],
  ],
  users: [
    ["name", "Name", "الاسم"],
    ["email", "Email", "البريد"],
    ["organizationName", "Workspace", "الشركة"],
    ["roleName", "Role", "الدور"],
    ["isActive", "Status", "الحالة"],
  ],
  plans: [
    ["name", "Plan", "الخطة"],
    ["monthlyPrice", "Monthly", "السعر الشهري"],
    ["annualPrice", "Annual", "السعر السنوي"],
    ["pricingVersion", "Price version", "إصدار السعر"],
    ["isActive", "Published", "منشورة"],
  ],
  subscriptions: [
    ["organizationName", "Workspace", "الشركة"],
    ["planName", "Plan", "الخطة"],
    ["status", "Status", "الحالة"],
    ["billingInterval", "Billing interval", "دورة الفوترة"],
    ["endsAt", "Ends at", "تاريخ النهاية"],
  ],
  integrations: [
    ["organizationName", "Workspace", "الشركة"],
    ["provider", "Provider", "المزود"],
    ["accountEmail", "Account", "الحساب"],
    ["tokenExpiresAt", "Token expiry", "انتهاء الرمز"],
    ["updatedAt", "Last update", "آخر تحديث"],
  ],
  support: [
    ["subject", "Subject", "العنوان"],
    ["organizationName", "Workspace", "الشركة"],
    ["status", "Status", "الحالة"],
    ["priority", "Priority", "الأولوية"],
    ["contactEmail", "Contact", "التواصل"],
  ],
  settings: [
    ["key", "Setting", "الإعداد"],
    ["value", "Value", "القيمة"],
    ["updatedAt", "Last update", "آخر تحديث"],
  ],
};
const labels: Record<string, [string, string]> = {
  ACTIVE: ["Active", "نشط"],
  TRIAL: ["Trial", "تجريبي"],
  PAST_DUE: ["Past due", "متأخر"],
  CANCELLED: ["Cancelled", "ملغي"],
  EXPIRED: ["Expired", "منتهي"],
  OPEN: ["Open", "مفتوح"],
  IN_PROGRESS: ["In progress", "قيد العمل"],
  RESOLVED: ["Resolved", "تم الحل"],
  CLOSED: ["Closed", "مغلق"],
  LOW: ["Low", "منخفض"],
  NORMAL: ["Normal", "عادي"],
  HIGH: ["High", "مرتفع"],
  URGENT: ["Urgent", "عاجل"],
  PENDING: ["Pending", "قيد الإعداد"],
  COMPLETE: ["Complete", "مكتمل"],
  LEGACY: ["Existing workspace", "شركة سابقة"],
  monthly: ["Monthly", "شهري"],
  annual: ["Annual", "سنوي"],
};
const settingLabels: Record<string, [string, string]> = {
  signup_enabled: ["Allow new company registration", "السماح بتسجيل شركات جديدة"],
  signup_default_plan_slug: ["Default plan for new companies", "الخطة الافتراضية للشركات الجديدة"],
  support_email: ["Platform support email", "بريد دعم المنصة"],
  platform_name: ["Platform name", "اسم المنصة"],
  default_language: ["Default language", "اللغة الافتراضية"],
  default_timezone: ["Default timezone", "المنطقة الزمنية الافتراضية"],
  paid_subscription_start_policy: ["Paid subscription starts", "موعد بدء الاشتراك المدفوع"],
  paid_subscription_monthly_months: ["Monthly subscription duration", "مدة الاشتراك الشهري"],
  paid_subscription_annual_months: ["Annual subscription duration", "مدة الاشتراك السنوي"],
};
const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800";

export function PlatformManagementView({
  section,
  data,
}: {
  section: PlatformSection;
  data: PlatformSectionData;
}) {
  const { language } = useI18n();
  const ar = language === "ar";
  const router = useRouter();
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [search, setSearch] = useState(data.search);
  const [editor, setEditor] = useState<{
    record: PlatformRecord | null;
  } | null>(null);
  const [detail, setDetail] = useState<PlatformRecord | null>(null);
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const resource = data.resource;
  const access = getPlatformResourceAccess(resource, section);
  const isMonitoring = ["health", "analytics"].includes(section);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const route = (page: number, query = search, selected: string = resource) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (page > 1) params.set("page", String(page));
    if (section === "billing") params.set("resource", selected);
    return `/admin/platform/${section}${params.size ? `?${params}` : ""}`;
  };
  const recordName = (item: PlatformRecord) =>
    String(
      item.name ?? item.subject ?? item.key ?? item.organizationName ?? item.id,
    );
  function value(key: string, item: PlatformRecord): string {
    const raw = item[key];
    if (key === "key" && typeof raw === "string" && settingLabels[raw])
      return settingLabels[raw][ar ? 1 : 0];
    if (key === "value" && item.key === "signup_enabled")
      return String(raw) === "true"
        ? text("Enabled", "مفعّل")
        : text("Disabled", "موقوف");
    if (key === "value" && item.key === "paid_subscription_start_policy")
      return text("When payment is confirmed", "عند تأكيد الدفع");
    if (key === "value" && item.key === "default_language")
      return String(raw) === "ar"
        ? text("Arabic", "العربية")
        : text("English", "الإنجليزية");
    if (
      key === "value" &&
      [
        "paid_subscription_monthly_months",
        "paid_subscription_annual_months",
      ].includes(String(item.key))
    )
      return `${raw} ${text("month(s)", "شهر")}`;
    if (typeof raw === "boolean")
      return raw ? text("Active", "نشط") : text("Inactive", "موقوف");
    if (raw === null || raw === undefined || raw === "")
      return key === "userLimit"
        ? text("Unlimited", "غير محدود")
        : ["monthlyPrice", "annualPrice"].includes(key)
          ? text("Custom", "مخصص")
          : "—";
    if (
      [
        "createdAt",
        "updatedAt",
        "lastLoginAt",
        "startsAt",
        "endsAt",
        "tokenExpiresAt",
      ].includes(key)
    )
      return new Intl.DateTimeFormat(ar ? "ar-JO" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(String(raw)));
    if (["monthlyPrice", "annualPrice"].includes(key))
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: String(item.currency ?? "JOD"),
      }).format(Number(raw));
    return labels[String(raw)]?.[ar ? 1 : 0] ?? String(raw);
  }
  const stats = [
    [text("Organizations", "الشركات"), data.stats.organizations],
    [text("Active users", "المستخدمون النشطون"), data.stats.activeUsers],
    [text("Connections", "الاتصالات"), data.stats.integrations],
    [
      text("Active subscriptions", "الاشتراكات النشطة"),
      data.stats.activeSubscriptions,
    ],
    [
      text("Open support cases", "طلبات الدعم المفتوحة"),
      data.stats.supportCases,
    ],
  ];
  const showOverviewStats = ["signups", "health", "analytics"].includes(
    section,
  );
  const signals =
    section === "health"
      ? [
          [
            text("Database query", "استعلام قاعدة البيانات"),
            `${data.health?.databaseMs ?? 0} ms`,
          ],
          [
            text("Google OAuth", "ربط Google"),
            data.health?.googleConfigured
              ? text("Configured", "مهيأ")
              : text("Not configured", "غير مهيأ"),
          ],
          [
            text("Microsoft OAuth", "ربط Microsoft"),
            data.health?.microsoftConfigured
              ? text("Configured", "مهيأ")
              : text("Not configured", "غير مهيأ"),
          ],
          [
            text("Open workspace tickets", "تذاكر الشركات المفتوحة"),
            data.stats.openTickets,
          ],
        ]
      : [
          [
            text("New workspaces in 30 days", "شركات جديدة خلال 30 يومًا"),
            data.stats.newOrganizations,
          ],
          [
            text("Active workspaces", "الشركات النشطة"),
            data.stats.activeOrganizations,
          ],
          [text("Total users", "جميع المستخدمين"), data.stats.users],
          [text("Audit events", "أحداث التدقيق"), data.stats.auditEvents],
        ];
  const description = (() => {
    if (section === "signups")
      return text(
        "Monitor company registrations and onboarding progress. This page is view-only.",
        "مراقبة تسجيل الشركات وتقدم بدء الاستخدام. هذه الصفحة للقراءة فقط.",
      );
    if (section === "health")
      return text(
        "Live service indicators. Monitoring data cannot be edited.",
        "مؤشرات مباشرة للخدمات، ولا يمكن تعديل بيانات المراقبة.",
      );
    if (section === "analytics")
      return text(
        "Platform-wide usage indicators. Analytics are view-only.",
        "مؤشرات استخدام المنصة كاملة، والتحليلات للقراءة فقط.",
      );
    if (resource === "organizations")
      return text(
        "Update company identity or suspend access when necessary. Companies are created through registration and retained for history.",
        "يمكن تعديل هوية الشركة أو إيقافها عند الحاجة. تُنشأ الشركات عبر التسجيل وتُحفظ سجلاتها للتاريخ.",
      );
    if (resource === "users")
      return text(
        "Review users across companies. Each company administrator manages their own team and access.",
        "مراجعة المستخدمين عبر الشركات. يدير مسؤول كل شركة فريقه وصلاحياته بنفسه.",
      );
    if (resource === "plans")
      return text(
        "Manage the published plan catalog. Retire a plan by unpublishing it instead of deleting its history.",
        "إدارة كتالوج الخطط المنشورة. يتم إيقاف نشر الخطة بدلاً من حذف سجلها التاريخي.",
      );
    if (resource === "subscriptions")
      return text(
        "Subscription history is view-only here. Activation and payment changes use the approval workflow.",
        "سجل الاشتراكات للقراءة فقط هنا. يتم التفعيل وتغييرات الدفع من خلال مسار الطلبات والموافقة.",
      );
    if (resource === "integrations")
      return text(
        "Monitor company connection status without changing tenant-owned credentials.",
        "مراقبة حالة ربط الشركات دون تعديل بيانات الدخول المملوكة للشركة.",
      );
    if (resource === "support")
      return text(
        "Keep the original request unchanged; update only its priority, status, and resolution.",
        "يبقى الطلب الأصلي دون تغيير؛ ويمكن تحديث الأولوية والحالة والحل فقط.",
      );
    return text(
      "Edit approved platform settings. Setting keys and their history cannot be added or deleted here.",
      "تعديل إعدادات المنصة المعتمدة. لا يمكن إضافة مفاتيح الإعدادات أو حذفها من هنا.",
    );
  })();
  const accessLabel =
    access.mode === "read-only"
      ? text("View only", "للقراءة فقط")
      : access.mode === "catalog"
        ? text("Catalog management", "إدارة الكتالوج")
        : text("Limited editing", "تعديل محدود");
  return (
    <div className="space-y-6 pb-10" dir={ar ? "rtl" : "ltr"}>
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm font-semibold text-violet-600"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {text("Platform overview", "لوحة المنصة")}
      </Link>
      {["organizations", "billing"].includes(section) && (
        <nav className="flex flex-wrap gap-3">
          <Link href="/admin/platform/organizations" className={button}>
            {text("Company statistics & plans", "إحصائيات الشركات وخططها")}
          </Link>
          <Link href="/admin/platform/upgrade-requests" className={button}>
            {text("Plan upgrade requests", "طلبات ترقية الخطط")}
          </Link>
        </nav>
      )}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-violet-600">
            {data.defaults.platform_name ||
              text("Platform administration", "إدارة المنصة")}
          </p>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">
            {names[section][ar ? 1 : 0]}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>
          <span
            className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${access.mode === "read-only" ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" : "bg-violet-500/10 text-violet-700 dark:text-violet-300"}`}
          >
            {accessLabel}
          </span>
        </div>
        <div className="flex gap-2">
          <button className={button} onClick={() => router.refresh()}>
            <RefreshCw className="h-4 w-4" />
            {text("Refresh", "تحديث")}
          </button>
          {access.canCreate && (
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white"
              onClick={() => {
                setFeedback(null);
                setEditor({ record: null });
              }}
            >
              <Plus className="h-4 w-4" />
              {text("Add plan", "إضافة خطة")}
            </button>
          )}
        </div>
      </header>
      {section === "organizations" && (
        <nav
          className="flex flex-wrap gap-2"
          aria-label={text("Organization views", "عروض الشركات")}
        >
          <Link
            href="/admin/platform/organizations"
            className={`${button} border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300`}
          >
            {text("Company settings", "إعدادات الشركات")}
          </Link>
          <Link
            href="/admin/platform/organizations?view=statistics"
            className={button}
          >
            {text("Detailed statistics", "الإحصاءات التفصيلية")}
          </Link>
        </nav>
      )}
      {showOverviewStats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {stats.map(([label, count]) => (
            <div key={String(label)} className={card}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black">{count}</p>
            </div>
          ))}
        </div>
      )}
      {feedback && (
        <p
          role={feedback.success ? "status" : "alert"}
          className={`rounded-xl p-4 text-sm ${feedback.success ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}
        >
          {feedback.message}
        </p>
      )}
      {section === "billing" && (
        <>
          <nav
            className="flex flex-wrap gap-2"
            aria-label={text("Billing sections", "أقسام الفوترة")}
          >
            {(["plans", "subscriptions"] as const).map((tab) => (
              <Link
                href={route(1, "", tab)}
                key={tab}
                className={`${button} ${resource === tab ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" : ""}`}
              >
                {names[tab][ar ? 1 : 0]}
              </Link>
            ))}
          </nav>
          <p className="text-sm text-slate-500">
            {text(
              "Subscriptions are administrative records. Payment collection requires a connected payment provider.",
              "الاشتراكات سجلات إدارية. تحصيل المدفوعات يتطلب ربط مزود دفع.",
            )}
          </p>
        </>
      )}
      {!isMonitoring ? (
        <section className={`${card} overflow-hidden`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">
              {names[resource][ar ? 1 : 0]}{" "}
              <span className="ms-2 text-sm font-normal text-slate-500">
                ({data.total})
              </span>
            </h2>
            <form
              className="flex w-full gap-2 sm:w-auto"
              onSubmit={(event) => {
                event.preventDefault();
                router.push(route(1));
              }}
            >
              <input
                aria-label={text("Search records", "البحث في السجلات")}
                placeholder={text("Search records…", "البحث في السجلات…")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
              />
              <button className={button} aria-label={text("Search", "بحث")}>
                <Search className="h-4 w-4" />
              </button>
            </form>
          </div>
          {data.records.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    {columns[resource].map(([key, en, arabic]) => (
                      <th
                        className="px-3 py-3 text-start text-xs text-slate-500"
                        key={key}
                      >
                        {text(en, arabic)}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-end text-xs text-slate-500">
                      {access.canUpdate
                        ? text("Actions", "الإجراءات")
                        : text("Details", "التفاصيل")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800/70"
                    >
                      {columns[resource].map(([key]) => (
                        <td key={key} className="max-w-64 px-3 py-4">
                          <span
                            className={`block ${key === "name" || key === "subject" ? "font-bold" : "text-slate-600 dark:text-slate-300"} ${key === "email" || key === "accountEmail" ? "break-all" : "truncate"}`}
                            title={value(key, item)}
                          >
                            {value(key, item)}
                          </span>
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            className="rounded-lg p-2 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                            aria-label={`${text("View", "عرض")}: ${recordName(item)}`}
                            onClick={() => setDetail(item)}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {item.protected ? (
                            <span
                              className="p-2 text-slate-500"
                              title={text(
                                "Protected platform administrator",
                                "حساب مدير منصة محمي",
                              )}
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </span>
                          ) : access.canUpdate && resource === "support" ? (
                            <button
                              className="rounded-lg p-2 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                              aria-label={`${text("Reply to support request", "الرد على طلب الدعم")}: ${recordName(item)}`}
                              title={text("Reply and update status", "الرد وتحديث الحالة")}
                              onClick={() => {
                                setFeedback(null);
                                setEditor({ record: item });
                              }}
                            >
                              <MessageSquareReply className="h-4 w-4" />
                            </button>
                          ) : access.canUpdate &&
                            !(
                              resource === "settings" &&
                              item.key === "paid_subscription_start_policy"
                            ) ? (
                            <button
                              className="rounded-lg p-2 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                              aria-label={`${text("Edit", "تعديل")}: ${recordName(item)}`}
                              onClick={() => {
                                setFeedback(null);
                                setEditor({ record: item });
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="font-bold">
                {text("No records found", "لا توجد سجلات")}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {access.canCreate
                  ? text(
                      "Add a record or change your search.",
                      "أضف سجلاً أو غيّر البحث.",
                    )
                  : text(
                      "Change the search to find a different record.",
                      "غيّر البحث للعثور على سجل آخر.",
                    )}
              </p>
            </div>
          )}
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="text-xs text-slate-500">
              {text(
                `Page ${data.page} of ${pages}`,
                `الصفحة ${data.page} من ${pages}`,
              )}
            </p>
            <div className="flex gap-2">
              <button
                disabled={data.page <= 1}
                className={button}
                onClick={() => router.push(route(data.page - 1))}
              >
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                {text("Previous", "السابق")}
              </button>
              <button
                disabled={data.page >= pages}
                className={button}
                onClick={() => router.push(route(data.page + 1))}
              >
                {text("Next", "التالي")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {signals.map(([name, count]) => (
            <section className={card} key={String(name)}>
              <h2 className="text-sm text-slate-500">{name}</h2>
              <p className="mt-3 text-3xl font-black">{count}</p>
            </section>
          ))}
        </div>
      )}
      {editor && (
        <PlatformRecordForm
          key={`${resource}-${editor.record?.id ?? "new"}`}
          resource={resource}
          record={editor.record}
          options={data.options}
          defaults={data.defaults}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setFeedback({
              success: true,
              message: text("Changes saved.", "تم حفظ التغييرات."),
            });
            router.refresh();
          }}
        />
      )}
      {detail && (
        <Modal
          isOpen
          onClose={() => setDetail(null)}
          title={text("Record details", "تفاصيل السجل")}
          closeLabel={text("Close", "إغلاق")}
        >
          <dl className="space-y-4" dir={ar ? "rtl" : "ltr"}>
            {Object.keys(detail)
              .filter(
                (key) =>
                  ![
                    "protected",
                    "roleId",
                    "departmentId",
                    "organizationId",
                    "planId",
                  ].includes(key),
              )
              .map((key) => (
                <div key={key}>
                  <dt className="text-xs text-slate-500">
                    {columns[resource].find((column) => column[0] === key)?.[
                      ar ? 2 : 1
                    ] ?? key}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold">
                    {value(key, detail)}
                  </dd>
                </div>
              ))}
          </dl>
        </Modal>
      )}
    </div>
  );
}
