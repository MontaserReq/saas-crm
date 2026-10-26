"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import type {
  CompanyStatistics,
  CompanyStatisticsService,
} from "@/server/services/CompanyStatisticsService";
import {
  CompanyPlanEditor,
  CompanyTrialEditor,
  planPanel,
  planStatus,
} from "@/components/settings/SubscriptionView";
import { planFeatureLabels } from "@/lib/platform/entitlements";
import { getAuditActionLabel } from "@/lib/i18n/auditLabels";

export function CompanyDirectory({
  data,
  search,
  page,
}: {
  data: Awaited<ReturnType<typeof CompanyStatisticsService.list>>;
  search: string;
  page: number;
}) {
  const { language } = useI18n();
  const ar = language === "ar";
  const href = (value: number) =>
    `/admin/platform/organizations?view=statistics&search=${encodeURIComponent(search)}&page=${value}`;
  const managementLink = (
    <Link
      href="/admin/platform/organizations"
      className="inline-block text-sm font-bold text-violet-600 hover:underline"
    >
      {ar ? "إعدادات الشركات وحالتها" : "Company settings & status"}
    </Link>
  );
  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black">
          {ar ? "الشركات وإحصائياتها" : "Companies & statistics"}
        </h1>
        <Link
          href="/admin/platform/upgrade-requests"
          className="font-bold text-violet-600 hover:underline"
        >
          {ar ? "طلبات ترقية الخطط" : "Plan upgrade requests"}
        </Link>
      </div>
      <p className="text-sm text-slate-500">
        {data.total}{" "}
        {ar
          ? "شركة مسجلة — افتح الشركة لمراجعة خطتها وإحصائياتها."
          : "registered companies — open a company to review its plan and statistics."}
      </p>
      {managementLink}
      <form className="flex gap-3">
        <input type="hidden" name="view" value="statistics" />
        <label className="sr-only" htmlFor="company-search">
          {ar ? "بحث عن شركة" : "Search companies"}
        </label>
        <input
          id="company-search"
          name="search"
          defaultValue={search}
          placeholder={ar ? "ابحث باسم الشركة…" : "Search company name…"}
          className="min-w-0 flex-1 rounded-xl border bg-transparent p-3"
        />
        <button className="rounded-xl bg-violet-600 px-5 font-bold text-white">
          {ar ? "بحث" : "Search"}
        </button>
      </form>
      <div className="grid gap-4 md:grid-cols-2">
        {data.organizations.map((org) => (
          <Link
            key={org.id}
            href={`/admin/platform/organizations/${org.id}`}
            className={`${planPanel} block transition hover:border-violet-400`}
          >
            <div className="flex justify-between gap-3">
              <h2 className="text-xl font-bold">{org.name}</h2>
              <span
                className={
                  org.isActive
                    ? "text-sm text-emerald-600"
                    : "text-sm text-red-600"
                }
              >
                {org.isActive
                  ? ar
                    ? "نشطة"
                    : "Active"
                  : ar
                    ? "موقوفة"
                    : "Inactive"}
              </span>
            </div>
            <p className="mt-2 text-sm text-violet-600">
              {org.platformSubscription?.plan.name ??
                (ar ? "بدون خطة" : "No plan")}
              {org.platformSubscription &&
                ` · ${planStatus(org.platformSubscription.status, ar)}`}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              {org._count.members} {ar ? "مستخدم نشط" : "active users"} ·{" "}
              {org._count.clients} {ar ? "عميل" : "clients"} ·{" "}
              {org._count.deals} {ar ? "صفقة" : "deals"} · {org._count.tickets}{" "}
              {ar ? "تذكرة" : "tickets"}
            </p>
            {org._count.planUpgradeRequests > 0 && (
              <p className="mt-3 text-sm font-bold text-amber-600">
                {ar ? "طلب ترقية قيد المراجعة" : "Upgrade request pending"}
              </p>
            )}
            <p className="mt-4 text-xs text-slate-500">
              {ar ? "تاريخ التسجيل" : "Registered"}:{" "}
              {new Date(org.createdAt).toLocaleDateString(
                ar ? "ar-JO" : "en-US",
              )}
            </p>
          </Link>
        ))}
      </div>
      {!data.organizations.length && (
        <p className={planPanel}>
          {ar ? "لا توجد شركات مطابقة." : "No matching companies."}
        </p>
      )}
      <div className="flex items-center justify-between">
        {page > 1 ? (
          <Link href={href(page - 1)}>{ar ? "السابق" : "Previous"}</Link>
        ) : (
          <span />
        )}
        <span>
          {page} / {Math.max(1, Math.ceil(data.total / 20))}
        </span>
        {page * 20 < data.total ? (
          <Link href={href(page + 1)}>{ar ? "التالي" : "Next"}</Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

export function CompanyStatisticsView({ data }: { data: CompanyStatistics }) {
  const { language, getStatusLabel, getRoleLabel } = useI18n();
  const ar = language === "ar";
  const locale = ar ? "ar-JO" : "en-US";
  const labels: Record<string, string> = {
    teams: "الفرق",
    departments: "الأقسام",
    pipelines: "مسارات المبيعات",
    workflows: "سير العمل",
    workflowExecutions: "تنفيذات سير العمل",
    messages: "الرسائل",
    proposals: "العروض",
    calendarEvents: "أحداث التقويم",
    auditLogs: "أحداث التدقيق",
    researchJobs: "عمليات البحث الذكي",
    clients: "العملاء",
    contacts: "جهات الاتصال",
    leads: "العملاء المحتملون",
    deals: "الصفقات",
    tasks: "المهام",
    tickets: "التذاكر",
    members: "إجمالي الأعضاء",
    activeMembers: "المستخدمون النشطون",
    integrations: "التكاملات",
    files: "ملفات المرفقات",
  };
  const date = (value: string | null) =>
    value ? new Date(value).toLocaleString(locale) : ar ? "لا يوجد" : "None";
  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      <Link
        href="/admin/platform/organizations"
        className="text-sm font-bold text-violet-600 hover:underline"
      >
        {ar ? "العودة إلى الشركات" : "Back to companies"}
      </Link>
      <div>
        <h1 className="text-3xl font-black">{data.organization.name}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {data.organization.slug} ·{" "}
          {data.organization.isActive
            ? ar
              ? "نشطة"
              : "Active"
            : ar
              ? "موقوفة"
              : "Inactive"}{" "}
          · {data.organization.timezone} · {data.organization.currency} ·{" "}
          {date(data.organization.createdAt)}
        </p>
      </div>
      <section className={planPanel}>
        <h2 className="text-xl font-bold">
          {ar ? "الاشتراك والاستخدام" : "Subscription & usage"}
        </h2>
        <p className="mt-3">
          {data.subscription
            ? `${data.subscription.plan} · ${planStatus(data.subscription.status, ar)} · ${data.subscription.billingInterval === "annual" ? (ar ? "سنوي" : "Annual") : ar ? "شهري" : "Monthly"}`
            : ar
              ? "لم تُعيّن خطة لهذه الشركة بعد."
              : "This company has no assigned plan yet."}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {ar ? "المستخدمون النشطون / حد الخطة" : "Active users / plan limit"}:{" "}
          {data.counts.activeMembers} /{" "}
          {data.subscription
            ? (data.subscription.userLimit ?? (ar ? "غير محدود" : "Unlimited"))
            : "—"}{" "}
          ·{" "}
          {ar
            ? "حجم مرفقات التذاكر والرسائل"
            : "Ticket & message attachment storage"}
          :{" "}
          {(data.storageBytes / 1048576).toLocaleString(locale, {
            maximumFractionDigits: 2,
          })}{" "}
          MB
        </p>
        {data.subscription?.endsAt && (
          <p className="mt-2 text-sm">
            {data.subscription.status === "TRIAL" ? (ar ? "نهاية التجربة" : "Trial ends") : (ar ? "نهاية الاشتراك" : "Subscription ends")}:{" "}
            {date(data.subscription.endsAt)}
          </p>
        )}
        {data.subscription && (
          <div className="mt-5">
            <p className="mb-2 text-sm font-bold">
              {ar ? "ميزات الخطة الفعالة" : "Effective plan features"}
            </p>
            <div className="flex flex-wrap gap-2">
              {data.subscription.features.map((feature) => (
                <span
                  key={feature}
                  className="rounded-full bg-violet-500/10 px-3 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-300"
                >
                  {planFeatureLabels[
                    feature as keyof typeof planFeatureLabels
                  ]?.[ar ? "ar" : "en"] ?? feature}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(data.counts).map(([key, value]) => (
          <div className={planPanel} key={key}>
            <p className="text-xs text-slate-500">
              {ar ? (labels[key] ?? key) : key.replace(/([A-Z])/g, " $1")}
            </p>
            <p className="mt-2 text-2xl font-black">
              {value.toLocaleString(locale)}
            </p>
          </div>
        ))}
      </div>
      <section className={planPanel}>
        <h2 className="mb-4 text-xl font-bold">
          {ar ? "نشاط آخر 30 يوماً" : "Activity in the last 30 days"}
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Object.entries(data.recent).map(([key, value]) => (
            <div key={key}>
              <p className="text-sm text-slate-500">
                {ar
                  ? key === "activity"
                    ? "أحداث التدقيق"
                    : labels[key]
                  : key === "activity"
                    ? "Audit events"
                    : `New ${key}`}
              </p>
              <p className="text-2xl font-bold">
                {value.toLocaleString(locale)}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className={planPanel}>
        <h2 className="mb-4 text-xl font-bold">
          {ar ? "المبيعات حسب العملة والحالة" : "Sales by currency & status"}
        </h2>
        {data.sales.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr>
                  {(ar
                    ? ["الحالة", "العملة", "عدد الصفقات", "قيمة الصفقات"]
                    : ["Status", "Currency", "Deals", "Deal value"]
                  ).map((label) => (
                    <th key={label} className="p-3 text-start">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sales.map((row) => (
                  <tr
                    key={`${row.status}-${row.currency}`}
                    className="border-t dark:border-slate-800"
                  >
                    <td className="p-3">{getStatusLabel(row.status)}</td>
                    <td className="p-3">{row.currency}</td>
                    <td className="p-3">{row.count}</td>
                    <td className="p-3">
                      {row.value.toLocaleString(locale, {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {ar ? "لا توجد صفقات." : "No deals."}
          </p>
        )}
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(data.statuses).map(([key, rows]) => (
          <section className={planPanel} key={key}>
            <h2 className="mb-4 font-bold">{ar ? labels[key] : key}</h2>
            {rows.length ? (
              rows.map((row) => (
                <div
                  key={row.status}
                  className="flex justify-between border-b py-2 text-sm dark:border-slate-800"
                >
                  <span>{getStatusLabel(row.status)}</span>
                  <strong>{row.count}</strong>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                {ar ? "لا توجد بيانات." : "No data."}
              </p>
            )}
          </section>
        ))}
      </div>
      <CompanyPlanEditor
        organizationId={data.organization.id}
        plans={data.plans}
        current={data.subscription}
      />
      <CompanyTrialEditor
        organizationId={data.organization.id}
        plans={data.plans}
        current={data.subscription}
      />
      <section className={planPanel}>
        <h2 className="mb-4 text-xl font-bold">
          {ar ? "فريق الشركة والوصول" : "Company team & access"}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {(ar
                  ? ["المستخدم", "الدور", "الحالة", "آخر دخول", "آخر نشاط"]
                  : ["User", "Role", "Status", "Last login", "Last active"]
                ).map((label) => (
                  <th key={label} className="p-3 text-start">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.id} className="border-t dark:border-slate-800">
                  <td className="p-3">
                    <p>{member.name}</p>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </td>
                  <td className="p-3">
                    {member.role ? getRoleLabel(member.role) : "—"}
                  </td>
                  <td className="p-3">
                    {member.isActive
                      ? getStatusLabel(member.status)
                      : ar
                        ? "المستخدم موقوف"
                        : "User disabled"}
                  </td>
                  <td className="p-3">{date(member.lastLoginAt)}</td>
                  <td className="p-3">{date(member.lastActiveAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={planPanel}>
          <h2 className="mb-4 text-xl font-bold">
            {ar ? "التكاملات المتصلة" : "Connected integrations"}
          </h2>
          {data.integrations.length ? (
            data.integrations.map((item) => (
              <div
                key={item.provider}
                className="border-b py-3 text-sm dark:border-slate-800"
              >
                <strong>{item.provider}</strong>
                <p>{item.accountEmail}</p>
                <p className="text-xs text-slate-500">{date(item.updatedAt)}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              {ar ? "لا توجد تكاملات." : "No integrations."}
            </p>
          )}
        </section>
        <section className={planPanel}>
          <h2 className="mb-4 text-xl font-bold">
            {ar ? "آخر أحداث التدقيق" : "Latest audit events"}
          </h2>
          {data.activity.length ? (
            data.activity.map((item) => (
              <div
                key={item.id}
                className="border-b py-3 text-sm dark:border-slate-800"
              >
                <p>{getAuditActionLabel(item.action, language)}</p>
                <p className="text-xs text-slate-500">
                  {item.actor?.name ?? (ar ? "النظام" : "System")} ·{" "}
                  {date(item.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              {ar ? "لا توجد أحداث." : "No events."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
