"use client";

import React from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { getAuditActionLabel } from "@/lib/i18n/auditLabels";

export function CrmDashboardSummary({
  data,
  modules,
}: {
  data: any;
  modules?: string[];
}) {
  const { language } = useI18n();
  const text = (en: string, ar: string) => (language === "ar" ? ar : en);
  const visible = (module: string) => !modules || modules.includes(module);
  const cards = [
    {
      module: "clients",
      label: text("Customers", "العملاء"),
      value: data.counts.clients,
      href: "/clients",
    },
    {
      module: "leads",
      label: text("Open leads", "العملاء المحتملون"),
      value: data.counts.leads,
      href: "/leads",
    },
    {
      module: "deals",
      label: text("Active deals", "الصفقات النشطة"),
      value: data.counts.deals,
      href: "/deals",
    },
    {
      module: "deals",
      label: text("Pipeline value", "قيمة الصفقات"),
      value: data.counts.pipelineValue,
      href: "/deals",
    },
    {
      module: "tasks",
      label: text("Open tasks", "المهام المفتوحة"),
      value: data.counts.openTasks,
      href: "/tasks",
    },
    {
      module: "tasks",
      label: text("Overdue tasks", "المهام المتأخرة"),
      value: data.counts.overdueTasks,
      href: "/tasks",
    },
  ].filter((card) => visible(card.module));
  return (
    <section dir={language === "ar" ? "rtl" : "ltr"} className="mb-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {text("CRM workspace", "مساحة إدارة العملاء")}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {text(
              "Your customer work at a glance.",
              "نظرة سريعة على أعمال عملائك.",
            )}
          </p>
        </div>
        {visible("deals") && (
          <Link
            href="/deals"
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          >
            {text("Open deals", "عرض الصفقات")}
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {visible("pipelines") && (
          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h2 className="font-semibold">
              {text("Pipeline summary", "ملخص مسار المبيعات")}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {data.pipelineSummary
                .flatMap((pipeline: any) => pipeline.stages)
                .slice(0, 10)
                .map((stage: any) => (
                  <div
                    key={stage.id}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900"
                  >
                    <span className="break-words">{stage.name}</span>
                    <span className="font-semibold">{stage._count.deals}</span>
                  </div>
                ))}
            </div>
          </section>
        )}
        {visible("tasks") && (
          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h2 className="font-semibold">
              {text("Upcoming tasks", "المهام القادمة")}
            </h2>
            <div className="mt-3 space-y-2">
              {data.upcomingTasks.length ? (
                data.upcomingTasks.slice(0, 5).map((task: any) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900"
                  >
                    <span className="font-medium">{task.title}</span>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">
                      {task.deal?.title ||
                        task.client?.name ||
                        text("General task", "مهمة عامة")}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {text("No upcoming tasks.", "لا توجد مهام قادمة.")}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
      <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <h2 className="font-semibold">
          {text("Recent activity", "النشاط الأخير")}
        </h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {data.recentActivity.length ? (
            data.recentActivity.slice(0, 6).map((event: any) => (
              <div
                key={event.id}
                className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900"
              >
                <span className="font-medium">
                  {getAuditActionLabel(event.action, language)}
                </span>
                <span className="ms-2 text-xs text-slate-600 dark:text-slate-400">
                  {event.actor?.name || text("System", "النظام")}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {text("No recent activity.", "لا يوجد نشاط حديث.")}
            </p>
          )}
        </div>
      </section>
    </section>
  );
}
