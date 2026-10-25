"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Archive, CheckCircle2, GitBranch, ListChecks, Pencil, Power, RotateCcw, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { archiveWorkflowAction, restoreWorkflowAction, setWorkflowActiveAction } from "@/server/actions/workflows";
import { formatNumber } from "@/lib/formatters";
import { StatusPill, WorkspaceEmpty, WorkspaceHeader, WorkspaceNotice, WorkspaceStats, WorkspaceTabs, workspaceSecondary } from "@/components/crm/WorkspaceUI";
import { WorkflowBuilder } from "./WorkflowBuilder";

type WorkflowFilter = "ALL" | "ACTIVE" | "PAUSED" | "ARCHIVED";

export function WorkflowsView({
  workflows,
  members,
  stages,
}: {
  workflows: any[];
  members: Array<{ id: string; name: string }>;
  stages: Array<{ id: string; name: string; pipelineName: string }>;
}) {
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [items, setItems] = useState(workflows);
  const [filter, setFilter] = useState<WorkflowFilter>("ALL");
  const [editingWorkflow, setEditingWorkflow] = useState<any | null>(null);
  const [notice, setNotice] = useState({ message: "", error: false });

  const activeWorkflows = items.filter((workflow) => !workflow.archivedAt && workflow.isActive);
  const pausedWorkflows = items.filter((workflow) => !workflow.archivedAt && !workflow.isActive);
  const archivedWorkflows = items.filter((workflow) => Boolean(workflow.archivedAt));
  const totalExecutions = items.reduce((total, workflow) => total + (workflow._count?.executions || 0), 0);

  const entityLabel = (value: string) => ({
    LEAD: text("Lead", "عميل محتمل"), CLIENT: text("Customer", "عميل"), CONTACT: text("Contact", "جهة اتصال"), DEAL: text("Deal", "صفقة"), TASK: text("Task", "مهمة"), TICKET: text("Ticket", "تذكرة"),
  }[value] || (ar ? "سجل" : value));
  const triggerLabel = (value: string) => ({
    RECORD_CREATED: text("record created", "تم إنشاء السجل"), RECORD_UPDATED: text("record updated", "تم تحديث السجل"), DEAL_STAGE_CHANGED: text("deal stage changed", "تغيرت مرحلة الصفقة"), DEAL_WON: text("deal won", "فوز الصفقة"), DEAL_LOST: text("deal lost", "خسارة الصفقة"), LEAD_STATUS_CHANGED: text("lead status changed", "تغيرت حالة العميل المحتمل"), LEAD_CONVERTED: text("lead converted", "تم تحويل العميل المحتمل"), TASK_CREATED: text("task created", "تم إنشاء المهمة"), TASK_COMPLETED: text("task completed", "تم إكمال المهمة"), TASK_OVERDUE: text("task overdue", "تأخرت المهمة"), TICKET_CREATED: text("ticket created", "تم إنشاء التذكرة"), TICKET_STATUS_CHANGED: text("ticket status changed", "تغيرت حالة التذكرة"),
  }[value] || value);
  const actionLabel = (value: string) => ({
    CREATE_TASK: text("create task", "إنشاء مهمة"), COMPLETE_TASK: text("complete task", "إكمال المهمة"), UPDATE_FIELD: text("update field", "تحديث حقل"), UPDATE_RECORD: text("update record", "تحديث السجل"), MOVE_DEAL_STAGE: text("move deal stage", "نقل مرحلة الصفقة"), ASSIGN_OWNER: text("assign owner", "تعيين مسؤول"), CREATE_NOTIFICATION: text("create notification", "إنشاء إشعار"), CREATE_ACTIVITY: text("create activity", "إنشاء نشاط"),
  }[value] || value);

  const visibleItems = useMemo(() => items.filter((workflow) => {
    if (filter === "ACTIVE") return !workflow.archivedAt && workflow.isActive;
    if (filter === "PAUSED") return !workflow.archivedAt && !workflow.isActive;
    if (filter === "ARCHIVED") return Boolean(workflow.archivedAt);
    return true;
  }), [filter, items]);

  function showError(error: unknown) {
    setNotice({ message: errorMessage(error as string), error: true });
  }
  function onSaved(workflow: any, isNew: boolean) {
    setItems((current) => isNew ? [workflow, ...current] : current.map((item) => item.id === workflow.id ? { ...item, ...workflow } : item));
    setEditingWorkflow(null);
    setNotice({ message: isNew ? text("Workflow created.", "تم إنشاء سير العمل.") : text("Workflow updated.", "تم تحديث سير العمل."), error: false });
  }
  async function toggle(workflow: any) {
    const result = await setWorkflowActiveAction(workflow.id, !workflow.isActive);
    if (result.success && result.workflow) {
      setItems((current) => current.map((item) => item.id === workflow.id ? { ...item, ...result.workflow } : item));
      setNotice({ message: result.workflow.isActive ? text("Workflow activated.", "تم تفعيل سير العمل.") : text("Workflow paused.", "تم إيقاف سير العمل مؤقتًا."), error: false });
    } else if (!result.success) showError(result.error);
  }
  async function archive(workflow: any) {
    const result = await archiveWorkflowAction(workflow.id);
    if (result.success && result.workflow) {
      setItems((current) => current.map((item) => item.id === workflow.id ? { ...item, ...result.workflow } : item));
      setNotice({ message: text("Workflow archived. You can find it under Archived.", "تمت أرشفة سير العمل. ستجده الآن ضمن تبويب المؤرشفة."), error: false });
    } else showError(result.error);
  }
  async function restore(workflow: any) {
    const result = await restoreWorkflowAction(workflow.id);
    if (result.success && result.workflow) {
      setItems((current) => current.map((item) => item.id === workflow.id ? { ...item, ...result.workflow } : item));
      setNotice({ message: text("Workflow restored and paused.", "تمت استعادة سير العمل وهو موقوف مؤقتًا."), error: false });
    } else showError(result.error);
  }

  return (
    <div dir={ar ? "rtl" : "ltr"} className="space-y-5">
      <WorkspaceHeader icon={GitBranch} eyebrow={text("AUTOMATION, UNDER CONTROL", "أتمتة واضحة وتحت تحكمك")} title={text("Workflows", "سير العمل")} subtitle={text("Automate the next step in your CRM whenever important records change.", "نظّم الخطوة التالية في نظام CRM عند حدوث تغييرات مهمة على سجلاتك.")} />
      <WorkspaceStats items={[
        { label: text("All workflows", "كل المسارات"), value: formatNumber(items.length, language), icon: GitBranch },
        { label: text("Active", "نشطة"), value: formatNumber(activeWorkflows.length, language), icon: CheckCircle2, tone: "green" },
        { label: text("Paused", "موقوفة"), value: formatNumber(pausedWorkflows.length, language), icon: Power, tone: "amber" },
        { label: text("Archived", "مؤرشفة"), value: formatNumber(archivedWorkflows.length, language), icon: Archive, tone: "burgundy" },
      ]} />

      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-amber-50 p-5 dark:border-brand-900/60 dark:from-brand-950/40 dark:via-slate-900 dark:to-amber-950/20 sm:p-6">
        <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm"><Zap className="h-5 w-5" /></span><div className="min-w-0"><h2 className="text-base font-extrabold text-slate-900 dark:text-white">{text("What does workflow automation do?", "شو وظيفة أتمتة سير العمل؟")}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{text("Build if-this-happens, then-do-that rules. The CRM watches for a change and performs the next step automatically.", "أنشئ قاعدة: إذا حدث شيء معيّن، نفّذ إجراء تلقائيًا. النظام يراقب التغيير وينفّذ الخطوة التالية.")}</p></div></div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center"><div className="rounded-xl border border-white/80 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/70"><div className="text-[11px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-300">{text("When", "عندما")}</div><div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{text("A lead becomes qualified", "يتحوّل العميل المحتمل إلى مؤهل")}</div></div><div className="hidden text-center text-xl font-black text-brand-600 md:block">→</div><div className="rounded-xl border border-white/80 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/70"><div className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">{text("Then", "فـ")}</div><div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{text("Create a follow-up task due in 2 days", "ينشئ مهمة متابعة مستحقة خلال يومين")}</div></div></div>
      </section>

      <WorkspaceNotice {...notice} />
      <WorkflowBuilder language={language as "ar" | "en"} members={members} stages={stages} workflow={editingWorkflow} onSaved={onSaved} onCancel={editingWorkflow ? () => setEditingWorkflow(null) : undefined} />

      <section className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-extrabold text-slate-900 dark:text-white">{text("Your workflows", "مسارات العمل لديك")}</h2><p className="mt-1 text-xs text-slate-500">{formatNumber(totalExecutions, language)} {text("total executions", "عملية تنفيذ إجمالًا")}</p></div><WorkspaceTabs label={text("Workflow status", "حالة سير العمل")} value={filter} onChange={(value) => setFilter(value as WorkflowFilter)} items={[{ value: "ALL", label: text("All", "الكل"), count: items.length }, { value: "ACTIVE", label: text("Active", "نشطة"), count: activeWorkflows.length }, { value: "PAUSED", label: text("Paused", "موقوفة"), count: pausedWorkflows.length }, { value: "ARCHIVED", label: text("Archived", "مؤرشفة"), count: archivedWorkflows.length }]} /></div>
      </section>

      {visibleItems.length === 0 ? <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><WorkspaceEmpty icon={filter === "ARCHIVED" ? Archive : GitBranch} title={text("No workflows in this view", "لا توجد مسارات في هذا العرض")} description={filter === "ARCHIVED" ? text("Archived workflows will appear here and can be restored.", "ستظهر هنا المسارات المؤرشفة ويمكن استعادتها.") : text("Create a workflow above to automate the next step for your team.", "أنشئ سير عمل من النموذج أعلاه لأتمتة الخطوة التالية لفريقك.")} /></section> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleItems.map((workflow) => {
            const archived = Boolean(workflow.archivedAt);
            const conditions = workflow.conditions && typeof workflow.conditions === "object" && Array.isArray(workflow.conditions.conditions) ? workflow.conditions.conditions.length : 0;
            const actions = Array.isArray(workflow.actions) ? workflow.actions : [];
            return <section key={workflow.id} className={`overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 ${archived ? "border-slate-200 opacity-85 dark:border-slate-800" : "border-slate-200 dark:border-slate-800"}`}>
              <div className="border-b border-slate-100 p-4 dark:border-slate-800 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"><GitBranch className="h-5 w-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-extrabold text-slate-900 dark:text-white">{workflow.name}</h2><StatusPill label={archived ? text("Archived", "مؤرشفة") : workflow.isActive ? text("Active", "نشط") : text("Paused", "موقوف")} tone={archived ? "neutral" : workflow.isActive ? "green" : "amber"} /></div><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{entityLabel(workflow.entityType)} · {triggerLabel(workflow.triggerType)}</p></div></div><span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400"><Activity className="h-4 w-4" />{formatNumber(workflow._count?.executions || 0, language)} {text("executions", "تنفيذ")}</span></div></div>
              <div className="flex flex-col gap-4 p-4 sm:p-5"><div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400"><span className="inline-flex items-center gap-1.5"><ListChecks className="h-4 w-4 text-brand-600 dark:text-brand-300" />{conditions} {text("conditions", "شروط")}</span><span className="inline-flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-600 dark:text-amber-300" />{actions.map((action: any) => actionLabel(action.type)).join(" · ")}</span></div><div className="flex flex-wrap gap-2 sm:justify-end"><Link href={`/settings/workflows/${workflow.id}/executions`} className={workspaceSecondary}><Activity className="h-4 w-4" />{text("Executions", "عمليات التنفيذ")}</Link>{!archived && <><button type="button" onClick={() => setEditingWorkflow(workflow)} className={workspaceSecondary}><Pencil className="h-4 w-4" />{text("Edit", "تعديل")}</button><button type="button" onClick={() => void toggle(workflow)} className={workspaceSecondary}><Power className="h-4 w-4" />{workflow.isActive ? text("Pause", "إيقاف") : text("Activate", "تفعيل")}</button><button type="button" onClick={() => void archive(workflow)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/70 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40"><Archive className="h-4 w-4" />{text("Archive", "أرشفة")}</button></>}{archived && <button type="button" onClick={() => void restore(workflow)} className={workspaceSecondary}><RotateCcw className="h-4 w-4" />{text("Restore", "استعادة")}</button>}</div></div>
            </section>;
          })}
        </div>
      )}
    </div>
  );
}
