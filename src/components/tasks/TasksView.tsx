"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ListTodo,
  CheckCheck,
  Clock3,
  CalendarDays,
  CircleCheck,
  Circle,
  Plus,
  Link2,
  Flag,
  Search,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { formatNumber } from "@/lib/formatters";
import {
  createCrmTaskAction,
  updateCrmTaskAction,
} from "@/server/actions/sales";
import { Modal } from "@/components/ui/Modal";
import {
  WorkspaceHeader,
  WorkspaceStats,
  WorkspaceSearch,
  WorkspaceTabs,
  WorkspaceEmpty,
  WorkspaceNotice,
  StatusPill,
  SubmitWorkspaceButton,
  workspaceInput,
  workspaceButton,
  workspaceSecondary,
} from "@/components/crm/WorkspaceUI";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: Date | string | null;
  description?: string | null;
  deal?: { title: string } | null;
  client?: { name: string } | null;
  lead?: { name: string } | null;
  contact?: { firstName: string; lastName?: string | null } | null;
  assignedUser?: { name: string } | null;
};
export function TasksView({
  tasks,
  canCreate = false,
  canUpdate = false,
  timeZone = "UTC",
  initialNow,
  initialClient = null,
  openCreate = false,
}: {
  tasks: Task[];
  canCreate?: boolean;
  canUpdate?: boolean;
  timeZone?: string;
  initialNow: number;
  initialClient?: { id: string; name: string } | null;
  openCreate?: boolean;
}) {
  const { language } = useI18n();
  const ar = language === "ar";
  const router = useRouter();
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("open");
  const [priority, setPriority] = useState("all");
  const [open, setOpen] = useState(openCreate && canCreate);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [completed, setCompleted] = useState<string[]>([]);
  const [notice, setNotice] = useState({ message: "", error: false });
  const [draft, setDraft] = useState({
    title: "",
    priority: "MEDIUM",
    dueDate: "",
    description: "",
    clientId: initialClient?.id || "",
  });
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);
  const statuses: Record<string, string> = {
    TODO: text("To do", "للتنفيذ"),
    IN_PROGRESS: text("In progress", "قيد التنفيذ"),
    COMPLETED: text("Completed", "مكتملة"),
    CANCELLED: text("Cancelled", "ملغاة"),
  };
  const priorities: Record<string, string> = {
    LOW: text("Low", "منخفضة"),
    MEDIUM: text("Normal", "عادية"),
    HIGH: text("High", "عالية"),
    URGENT: text("Urgent", "عاجلة"),
  };
  const statusOf = (task: Task) =>
    completed.includes(task.id) ? "COMPLETED" : task.status;
  const isOpen = (task: Task) =>
    !["COMPLETED", "CANCELLED"].includes(statusOf(task));
  const overdue = (task: Task) =>
    isOpen(task) && !!task.dueDate && new Date(task.dueDate).getTime() < now;
  const related = (task: Task) =>
    task.deal?.title ||
    task.client?.name ||
    task.lead?.name ||
    (task.contact
      ? [task.contact.firstName, task.contact.lastName]
          .filter(Boolean)
          .join(" ")
      : "");
  const shown = tasks.filter(
    (task) =>
      (filter === "all" ||
        (filter === "open" && isOpen(task)) ||
        (filter === "done" && statusOf(task) === "COMPLETED") ||
        (filter === "overdue" && overdue(task))) &&
      (priority === "all" || priority === task.priority) &&
      `${task.title} ${task.description || ""} ${related(task)}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const date = (task: Task) =>
    task.dueDate
      ? new Date(task.dueDate).toLocaleDateString(ar ? "ar-JO" : "en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone,
        })
      : text("No due date", "دون موعد محدد");
  function priorityPill(task: Task) {
    return (
      <StatusPill
        label={priorities[task.priority] || task.priority}
        tone={
          task.priority === "URGENT"
            ? "red"
            : task.priority === "HIGH"
              ? "amber"
              : task.priority === "MEDIUM"
                ? "purple"
                : "neutral"
        }
      />
    );
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice({ message: "", error: false });
    try {
      const result = await createCrmTaskAction({
        ...draft,
        title: draft.title.trim(),
        dueDate: draft.dueDate
          ? new Date(`${draft.dueDate}T23:59:59`).toISOString()
          : undefined,
      });
      if (!result.success) {
        setNotice({
          message: text(
            "Could not add the task. Check the details and try again.",
            "تعذرت إضافة المهمة. تحقق من البيانات وحاول مجدداً.",
          ),
          error: true,
        });
        return;
      }
      if (result.pendingApproval) {
        setOpen(false);
        setNotice({ message: text("Task request sent for approval.", "تم إرسال طلب المهمة للموافقة."), error: false });
        return;
      }
      setDraft({
        title: "",
        priority: "MEDIUM",
        dueDate: "",
        description: "",
        clientId: initialClient?.id || "",
      });
      setOpen(false);
      setFilter("open");
      setPriority("all");
      setSearch("");
      setNotice({
        message: text(
          "Task added. Your next step is ready.",
          "تمت إضافة المهمة. خطوتك القادمة جاهزة.",
        ),
        error: false,
      });
      router.refresh();
    } catch {
      setNotice({
        message: text(
          "Connection interrupted. Check your tasks before retrying.",
          "انقطع الاتصال. تحقق من قائمة المهام قبل إعادة المحاولة.",
        ),
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }
  async function complete(task: Task) {
    if (busyId) return;
    setBusyId(task.id);
    try {
      const result = await updateCrmTaskAction(task.id, {
        status: "COMPLETED",
      });
      if (!result.success) {
        setNotice({
          message: text(
            "Could not complete the task. Try again.",
            "تعذر إكمال المهمة. حاول مجدداً.",
          ),
          error: true,
        });
        return;
      }
      setCompleted((current) => [...current, task.id]);
      setNotice({
        message: text("Task completed.", "تم إكمال المهمة بنجاح."),
        error: false,
      });
      router.refresh();
    } catch {
      setNotice({
        message: text(
          "Check your connection and try again.",
          "تحقق من الاتصال وحاول مجدداً.",
        ),
        error: true,
      });
    } finally {
      setBusyId("");
    }
  }
  const add = () => {
    setNotice({ message: "", error: false });
    setOpen(true);
  };
  const completion = (task: Task) =>
    statusOf(task) === "COMPLETED" ? (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <CircleCheck className="h-4 w-4" />
        {text("Completed", "مكتملة")}
      </span>
    ) : canUpdate && isOpen(task) ? (
      <button
        type="button"
        disabled={!!busyId}
        onClick={() => complete(task)}
        aria-label={`${text("Complete task", "إكمال المهمة")}: ${task.title}`}
        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
      >
        <CircleCheck className="h-4 w-4" />
        {busyId === task.id
          ? text("Saving…", "جارٍ الحفظ…")
          : text("Complete", "إكمال")}
      </button>
    ) : null;
  return (
    <div dir={ar ? "rtl" : "ltr"} className="space-y-5">
      <WorkspaceHeader
        icon={ListTodo}
        eyebrow={text("YOUR TEAM’S NEXT STEPS", "خطوات فريقك القادمة")}
        title={text("Tasks", "المهام")}
        subtitle={text(
          "Less scattered work. More follow-through, one task at a time.",
          "نظّم الأولويات وتابع العمل خطوة بخطوة، دون أن تفوتك مهمة.",
        )}
        action={canCreate ? add : undefined}
        actionLabel={text("Add task", "إضافة مهمة")}
      />
      <WorkspaceStats
        items={[
          {
            label: text("All tasks", "إجمالي المهام"),
            value: formatNumber(tasks.length, language),
            icon: ListTodo,
          },
          {
            label: text("Open tasks", "المهام المفتوحة"),
            value: formatNumber(tasks.filter(isOpen).length, language),
            icon: Circle,
            tone: "burgundy",
          },
          {
            label: text("Completed", "المهام المكتملة"),
            value: formatNumber(
              tasks.filter((task) => statusOf(task) === "COMPLETED").length,
              language,
            ),
            icon: CheckCheck,
            tone: "green",
          },
          {
            label: text("Overdue", "المهام المتأخرة"),
            value: formatNumber(tasks.filter(overdue).length, language),
            icon: Clock3,
            tone: "amber",
          },
        ]}
      />
      {!open && <WorkspaceNotice {...notice} />}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:p-5">
          <WorkspaceTabs
            label={text("Task status", "حالة المهام")}
            value={filter}
            onChange={setFilter}
            items={[
              {
                value: "open",
                label: text("Open", "المفتوحة"),
                count: tasks.filter(isOpen).length,
              },
              {
                value: "all",
                label: text("All tasks", "الجميع"),
                count: tasks.length,
              },
              {
                value: "overdue",
                label: text("Overdue", "المتأخرة"),
                count: tasks.filter(overdue).length,
              },
              {
                value: "done",
                label: text("Completed", "المكتملة"),
                count: tasks.filter((task) => statusOf(task) === "COMPLETED")
                  .length,
              },
            ]}
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <WorkspaceSearch
              label={text("Search tasks", "البحث عن المهام")}
              value={search}
              onChange={setSearch}
              placeholder={text(
                "Find a task or customer…",
                "ابحث عن مهمة أو عميل…",
              )}
            />
            <label className="sm:w-44">
              <span className="sr-only">
                {text("Priority filter", "تصفية حسب الأولوية")}
              </span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className={workspaceInput}
              >
                <option value="all">
                  {text("All priorities", "جميع الأولويات")}
                </option>
                {Object.entries(priorities).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {!shown.length ? (
          <WorkspaceEmpty
            icon={tasks.length ? CheckCheck : ListTodo}
            title={
              tasks.length
                ? text("Nothing on this list", "لا توجد مهام في هذه القائمة")
                : text("Make room for what matters", "ابدأ بالمهام التي تهمك")
            }
            description={
              tasks.length
                ? text(
                    "Try another filter or add your next task.",
                    "جرّب تصفية أخرى أو أضف مهمتك القادمة.",
                  )
                : text(
                    "Add a follow-up, a customer call, or your team’s next step.",
                    "أضف متابعة أو اتصالاً بعميل أو خطوة قادمة لفريقك.",
                  )
            }
            action={
              tasks.length ? (
                <button
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    setPriority("all");
                    setSearch("");
                  }}
                  className={workspaceSecondary}
                >
                  <Search className="h-4 w-4" />
                  {text("Show all tasks", "عرض جميع المهام")}
                </button>
              ) : canCreate ? (
                <button onClick={add} className={workspaceButton}>
                  <Plus className="h-4 w-4" />
                  {text("Add task", "إضافة مهمة")}
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {shown.map((task) => (
                <article
                  key={task.id}
                  className={`rounded-2xl border p-4 ${overdue(task) ? "border-amber-200 bg-amber-50/20 dark:border-amber-900/60 dark:bg-amber-950/20" : "border-slate-200 dark:border-slate-800"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {priorityPill(task)}
                    <StatusPill
                      label={statuses[statusOf(task)] || statusOf(task)}
                      tone={
                        statusOf(task) === "COMPLETED"
                          ? "green"
                          : statusOf(task) === "IN_PROGRESS"
                            ? "purple"
                            : "neutral"
                      }
                    />
                  </div>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="mt-3 block break-words font-bold text-slate-900 dark:text-white"
                  >
                    {task.title}
                  </Link>
                  {related(task) && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Link2 className="h-3 w-3" />
                      {related(task)}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <span
                      className={`flex items-center gap-1.5 text-xs ${overdue(task) ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      {date(task)}
                    </span>
                    {completion(task)}
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70 text-xs text-slate-500 dark:text-slate-400 dark:bg-slate-800/40">
                  <tr>
                    {[
                      text("Task", "المهمة"),
                      text("Status", "الحالة"),
                      text("Priority", "الأولوية"),
                      text("Due date", "الموعد"),
                      text("Related to", "مرتبطة بـ"),
                      text("Action", "الإجراء"),
                    ].map((label) => (
                      <th
                        scope="col"
                        key={label}
                        className="px-5 py-3.5 text-start font-semibold"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {shown.map((task) => (
                    <tr
                      key={task.id}
                      className="transition hover:bg-brand-50/30 dark:hover:bg-brand-950/20"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/tasks/${task.id}`}
                          className="font-semibold text-slate-900 hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
                        >
                          {task.title}
                        </Link>
                        {task.assignedUser && (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {task.assignedUser.name}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill
                          label={statuses[statusOf(task)] || statusOf(task)}
                          tone={
                            statusOf(task) === "COMPLETED"
                              ? "green"
                              : statusOf(task) === "IN_PROGRESS"
                                ? "purple"
                                : "neutral"
                          }
                        />
                      </td>
                      <td className="px-5 py-4">{priorityPill(task)}</td>
                      <td
                        className={`whitespace-nowrap px-5 py-4 text-xs ${overdue(task) ? "font-semibold text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}
                      >
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {date(task)}
                        </span>
                      </td>
                      <td className="max-w-48 truncate px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                        {related(task) || "—"}
                      </td>
                      <td className="px-5 py-4">{completion(task)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:text-slate-400 dark:border-slate-800">
          {formatNumber(shown.length, language)}{" "}
          {text("tasks shown", "مهمة معروضة")}
        </p>
      </section>
      <Modal
        isOpen={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={text("Add a new task", "إضافة مهمة جديدة")}
        description={text(
          "Give the next step a clear name and priority.",
          "حدّد الخطوة القادمة باسم واضح وأولوية مناسبة.",
        )}
        closeLabel={text("Close", "إغلاق")}
        maxWidth="lg"
      >
        <form onSubmit={create} className="space-y-5">
          <fieldset disabled={busy} className="space-y-4">
            <label className="block text-sm font-semibold">
              {text("Task title", "عنوان المهمة")}
              <input
                required
                maxLength={180}
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
                placeholder={text(
                  "e.g. Follow up with the customer",
                  "مثال: متابعة عرض السعر مع العميل",
                )}
                className={`${workspaceInput} mt-2`}
              />
            </label>
            {initialClient && (
              <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3 text-sm dark:border-brand-900 dark:bg-brand-950/30">
                <span className="text-slate-500 dark:text-slate-400">
                  {text("Linked customer", "العميل المرتبط")}: {" "}
                </span>
                <Link
                  href={`/clients/${initialClient.id}`}
                  className="font-bold text-brand-700 dark:text-brand-300"
                >
                  {initialClient.name}
                </Link>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                <span className="flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5 text-brand-500" />
                  {text("Priority", "الأولوية")}
                </span>
                <select
                  aria-label={text("Priority", "الأولوية")}
                  value={draft.priority}
                  onChange={(event) =>
                    setDraft({ ...draft, priority: event.target.value })
                  }
                  className={`${workspaceInput} mt-2`}
                >
                  {Object.entries(priorities).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                {text("Due date (optional)", "موعد الإنجاز (اختياري)")}
                <input
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) =>
                    setDraft({ ...draft, dueDate: event.target.value })
                  }
                  className={`${workspaceInput} mt-2`}
                />
              </label>
            </div>
            <label className="block text-sm font-semibold">
              {text("Notes (optional)", "ملاحظات (اختياري)")}
              <textarea
                rows={3}
                maxLength={4000}
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                className={`${workspaceInput} mt-2 resize-y`}
              />
            </label>
          </fieldset>
          <WorkspaceNotice {...notice} />
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              className={workspaceSecondary}
            >
              {text("Cancel", "إلغاء")}
            </button>
            <SubmitWorkspaceButton
              busy={busy}
              label={text("Save task", "حفظ المهمة")}
              saving={text("Saving…", "جارٍ الحفظ…")}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
