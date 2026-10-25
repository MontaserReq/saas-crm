"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  Archive,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  FileText,
  Flag,
  RotateCcw,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import {
  deleteCrmTaskAction,
  updateCrmTaskAction,
} from "@/server/actions/sales";
import { useDialog } from "@/lib/dialog/context";

function DetailItem({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CalendarClock;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4 text-brand-600" />
        <span>{label}</span>
      </div>
      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
        {children}
      </div>
    </div>
  );
}

export function TaskDetailView({
  task,
  timeZone = "UTC",
  canUpdate = false,
  canDelete = false,
}: {
  task: any;
  timeZone?: string;
  canUpdate?: boolean;
  canDelete?: boolean;
}) {
  const { language, getStatusLabel, getPriorityLabel, errorMessage } =
    useI18n();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const router = useRouter();
  const { confirm } = useDialog();
  const isCompleted = task.status === "COMPLETED";
  const dateLocale = ar ? "ar-JO" : "en-US";
  const dueDate = task.dueDate
    ? new Date(task.dueDate).toLocaleString(dateLocale, {
        timeZone,
        dateStyle: "medium",
        timeStyle: "short",
      })
    : text("No due date", "لا يوجد موعد استحقاق");

  const remove = async () => {
    if (
      !(await confirm({
        title: text("Archive task", "أرشفة المهمة"),
        message: text(`Archive ${task.title}?`, `هل تريد أرشفة ${task.title}؟`),
        isDestructive: true,
      }))
    )
      return;

    const result = await deleteCrmTaskAction(task.id);
    if (result.success && !result.pendingApproval) router.push("/tasks");
    else if (result.success) {
      alert(
        text(
          "Task archive request sent for approval.",
          "تم إرسال طلب أرشفة المهمة للموافقة.",
        ),
      );
    } else alert(errorMessage(result.error));
  };

  const updateStatus = async (status: "COMPLETED" | "TODO") => {
    const result = await updateCrmTaskAction(task.id, { status });
    if (!result.success) {
      alert(errorMessage(result.error));
      return;
    }
    router.refresh();
  };

  return (
    <main dir={ar ? "rtl" : "ltr"} className="space-y-6 pb-10">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-2 transition hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {text("Tasks", "المهام")}
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {text("Task details", "تفاصيل المهمة")}
        </span>
      </div>

      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-9 sm:py-9">
        <div className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-brand-500/15 blur-2xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">
                <ClipboardList className="h-4 w-4 text-brand-300" />
                {text("Task", "مهمة")}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">
                {getStatusLabel(task.status)}
              </span>
              <span className="rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-200">
                {getPriorityLabel(task.priority)}
              </span>
            </div>
            <div>
              <p className="mb-2 text-sm text-slate-300">
                {text("Task overview", "نظرة عامة على المهمة")}
              </p>
              <h1 className="max-w-4xl text-2xl font-black tracking-tight sm:text-4xl">
                {task.title}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canUpdate && !isCompleted && (
              <button
                type="button"
                onClick={() => updateStatus("COMPLETED")}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-400"
              >
                <CheckCircle2 className="h-4 w-4" />
                {text("Complete task", "إكمال المهمة")}
              </button>
            )}
            {canUpdate && isCompleted && (
              <button
                type="button"
                onClick={() => updateStatus("TODO")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
              >
                <RotateCcw className="h-4 w-4" />
                {text("Reopen", "إعادة فتح")}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={remove}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300/40 bg-rose-500/15 px-4 py-2.5 text-sm font-bold text-rose-100 transition hover:bg-rose-500/25"
              >
                <Archive className="h-4 w-4" />
                {text("Archive", "أرشفة")}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
            <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-black text-slate-900 dark:text-slate-100">
                  {text("Description", "وصف المهمة")}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {text("The context and expected outcome", "السياق والنتيجة المطلوبة")}
                </p>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-8 text-slate-700 dark:text-slate-300">
              {task.description || text("No description provided.", "لم تتم إضافة وصف للمهمة.")}
            </p>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CircleDot className="h-5 w-5" />
                </span>
                <h2 className="font-black text-slate-900 dark:text-slate-100">
                  {text("Task information", "معلومات المهمة")}
                </h2>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {text("Details", "التفاصيل")}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem icon={CalendarClock} label={text("Due date", "موعد الاستحقاق")}>
                {dueDate}
              </DetailItem>
              <DetailItem icon={Flag} label={text("Priority", "الأولوية")}>
                {getPriorityLabel(task.priority)}
              </DetailItem>
              <DetailItem icon={CircleDot} label={text("Status", "الحالة")}>
                {getStatusLabel(task.status)}
              </DetailItem>
              <DetailItem icon={ClipboardList} label={text("Task type", "نوع المهمة")}>
                {task.taskType?.name || text("General", "عامة")}
              </DetailItem>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 border-b border-slate-100 pb-4 font-black text-slate-900 dark:border-slate-800 dark:text-slate-100">
              {text("Ownership", "التكليف والمتابعة")}
            </h2>
            <div className="space-y-3">
              <DetailItem icon={UserRound} label={text("Assignee", "المكلّف")}>
                {task.assignedUser?.name || text("Unassigned", "غير مكلّف")}
              </DetailItem>
              <DetailItem icon={UsersRound} label={text("Team", "الفريق")}>
                {task.assignedTeam?.name || text("No team", "لا يوجد فريق")}
              </DetailItem>
              <DetailItem icon={BriefcaseBusiness} label={text("Department", "القسم")}>
                {task.department?.name || "—"}
              </DetailItem>
            </div>
          </section>

          {(task.client || task.deal) && (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 border-b border-slate-100 pb-4 font-black text-slate-900 dark:border-slate-800 dark:text-slate-100">
                {text("Related records", "السجلات المرتبطة")}
              </h2>
              <div className="space-y-3">
                {task.client && (
                  <Link
                    href={`/clients/${task.client.id}`}
                    className="block rounded-2xl border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-800 dark:hover:border-brand-700 dark:hover:bg-brand-950/20"
                  >
                    <span className="text-xs text-slate-500">{text("Customer", "العميل")}</span>
                    <span className="mt-1 block font-bold text-brand-700 dark:text-brand-300">
                      {task.client.name}
                    </span>
                  </Link>
                )}
                {task.deal && (
                  <Link
                    href={`/deals/${task.deal.id}`}
                    className="block rounded-2xl border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-800 dark:hover:border-brand-700 dark:hover:bg-brand-950/20"
                  >
                    <span className="text-xs text-slate-500">{text("Deal", "الصفقة")}</span>
                    <span className="mt-1 block font-bold text-brand-700 dark:text-brand-300">
                      {task.deal.title}
                    </span>
                  </Link>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
