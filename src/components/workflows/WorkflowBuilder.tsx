"use client";

import { useEffect, useState } from "react";
import {
  ListPlus,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  createWorkflowAction,
  updateWorkflowAction,
} from "@/server/actions/workflows";
import {
  workspaceButton,
  workspaceInput,
  workspaceSecondary,
} from "@/components/crm/WorkspaceUI";

type BuilderLanguage = "ar" | "en";
type WorkflowOption = { id: string; name: string };
type StageOption = { id: string; name: string; pipelineName: string };

type ConditionDraft = { field: string; operator: string; value: string };
type ActionDraft = {
  type: string;
  title: string;
  description: string;
  dueInDays: string;
  userId: string;
  stageId: string;
  field: string;
  value: string;
  message: string;
};

type WorkflowDraft = {
  name: string;
  description: string;
  entity: string;
  trigger: string;
  logic: "ALL" | "ANY";
  conditions: ConditionDraft[];
  actions: ActionDraft[];
};

const entityOptions = [
  { value: "LEAD", en: "Lead", ar: "عميل محتمل" },
  { value: "CLIENT", en: "Customer", ar: "عميل" },
  { value: "CONTACT", en: "Contact", ar: "جهة اتصال" },
  { value: "DEAL", en: "Deal", ar: "صفقة" },
  { value: "TASK", en: "Task", ar: "مهمة" },
  { value: "TICKET", en: "Ticket", ar: "تذكرة" },
];

const triggerOptions: Record<string, Array<{ value: string; en: string; ar: string }>> = {
  LEAD: [
    { value: "RECORD_CREATED", en: "Lead created", ar: "إنشاء عميل محتمل" },
    { value: "RECORD_UPDATED", en: "Lead updated", ar: "تحديث عميل محتمل" },
    { value: "LEAD_STATUS_CHANGED", en: "Lead status changed", ar: "تغيرت حالة العميل المحتمل" },
    { value: "LEAD_CONVERTED", en: "Lead converted", ar: "تحويل العميل المحتمل" },
  ],
  CLIENT: [
    { value: "RECORD_CREATED", en: "Customer created", ar: "إنشاء عميل" },
    { value: "RECORD_UPDATED", en: "Customer updated", ar: "تحديث عميل" },
  ],
  CONTACT: [
    { value: "RECORD_CREATED", en: "Contact created", ar: "إنشاء جهة اتصال" },
    { value: "RECORD_UPDATED", en: "Contact updated", ar: "تحديث جهة اتصال" },
  ],
  DEAL: [
    { value: "RECORD_CREATED", en: "Deal created", ar: "إنشاء صفقة" },
    { value: "RECORD_UPDATED", en: "Deal updated", ar: "تحديث صفقة" },
    { value: "DEAL_STAGE_CHANGED", en: "Deal stage changed", ar: "تغيرت مرحلة الصفقة" },
    { value: "DEAL_WON", en: "Deal won", ar: "فوز الصفقة" },
    { value: "DEAL_LOST", en: "Deal lost", ar: "خسارة الصفقة" },
  ],
  TASK: [
    { value: "TASK_CREATED", en: "Task created", ar: "إنشاء مهمة" },
    { value: "TASK_COMPLETED", en: "Task completed", ar: "إكمال المهمة" },
    { value: "TASK_OVERDUE", en: "Task overdue", ar: "تأخر المهمة" },
  ],
  TICKET: [
    { value: "TICKET_CREATED", en: "Ticket created", ar: "إنشاء تذكرة" },
    { value: "TICKET_STATUS_CHANGED", en: "Ticket status changed", ar: "تغيرت حالة التذكرة" },
  ],
};

const fieldOptions: Record<string, Array<{ value: string; en: string; ar: string }>> = {
  LEAD: [
    { value: "status", en: "Status", ar: "الحالة" },
    { value: "name", en: "Name", ar: "الاسم" },
    { value: "source", en: "Source", ar: "المصدر" },
    { value: "email", en: "Email", ar: "البريد الإلكتروني" },
    { value: "assignedUserId", en: "Assigned user", ar: "المسؤول" },
  ],
  CLIENT: [
    { value: "status", en: "Status", ar: "الحالة" },
    { value: "type", en: "Type", ar: "النوع" },
    { value: "name", en: "Name", ar: "الاسم" },
    { value: "category", en: "Category", ar: "التصنيف" },
    { value: "email", en: "Email", ar: "البريد الإلكتروني" },
  ],
  CONTACT: [
    { value: "firstName", en: "First name", ar: "الاسم الأول" },
    { value: "lastName", en: "Last name", ar: "اسم العائلة" },
    { value: "jobTitle", en: "Job title", ar: "المسمى الوظيفي" },
    { value: "email", en: "Email", ar: "البريد الإلكتروني" },
    { value: "clientId", en: "Customer", ar: "العميل" },
  ],
  DEAL: [
    { value: "status", en: "Status", ar: "الحالة" },
    { value: "title", en: "Title", ar: "العنوان" },
    { value: "stageId", en: "Stage", ar: "المرحلة" },
    { value: "ownerId", en: "Owner", ar: "المسؤول" },
    { value: "value", en: "Value", ar: "القيمة" },
    { value: "probability", en: "Probability", ar: "الاحتمالية" },
  ],
  TASK: [
    { value: "status", en: "Status", ar: "الحالة" },
    { value: "title", en: "Title", ar: "العنوان" },
    { value: "priority", en: "Priority", ar: "الأولوية" },
    { value: "ownerId", en: "Owner", ar: "المسؤول" },
  ],
  TICKET: [
    { value: "status", en: "Status", ar: "الحالة" },
    { value: "subject", en: "Subject", ar: "الموضوع" },
    { value: "priority", en: "Priority", ar: "الأولوية" },
    { value: "departmentId", en: "Department", ar: "القسم" },
  ],
};

const operators = [
  { value: "equals", en: "Equals", ar: "يساوي" },
  { value: "not_equals", en: "Does not equal", ar: "لا يساوي" },
  { value: "contains", en: "Contains", ar: "يحتوي على" },
  { value: "starts_with", en: "Starts with", ar: "يبدأ بـ" },
  { value: "ends_with", en: "Ends with", ar: "ينتهي بـ" },
  { value: "in", en: "Is one of", ar: "واحد من" },
  { value: "not_in", en: "Is not one of", ar: "ليس واحدًا من" },
  { value: "exists", en: "Exists", ar: "موجود" },
  { value: "not_exists", en: "Does not exist", ar: "غير موجود" },
  { value: "is_empty", en: "Is empty", ar: "فارغ" },
  { value: "is_not_empty", en: "Is not empty", ar: "غير فارغ" },
  { value: "greater_than", en: "Greater than", ar: "أكبر من" },
  { value: "less_than", en: "Less than", ar: "أصغر من" },
];

const actionOptions = [
  { value: "CREATE_TASK", en: "Create a task", ar: "إنشاء مهمة" },
  { value: "COMPLETE_TASK", en: "Complete the task", ar: "إكمال المهمة" },
  { value: "UPDATE_FIELD", en: "Update a field", ar: "تحديث حقل" },
  { value: "MOVE_DEAL_STAGE", en: "Move deal to a stage", ar: "نقل الصفقة إلى مرحلة" },
  { value: "ASSIGN_OWNER", en: "Assign an owner", ar: "تعيين مسؤول" },
  { value: "CREATE_NOTIFICATION", en: "Create a notification", ar: "إنشاء إشعار" },
  { value: "CREATE_ACTIVITY", en: "Create an activity", ar: "إنشاء نشاط" },
];

const textFor = (language: BuilderLanguage, item: { en: string; ar: string }) =>
  language === "ar" ? item.ar : item.en;

function newCondition(entity: string): ConditionDraft {
  const first = fieldOptions[entity]?.[0]?.value || "status";
  return { field: first, operator: "equals", value: first === "status" && entity === "LEAD" ? "QUALIFIED" : "" };
}

function newAction(language: BuilderLanguage): ActionDraft {
  return {
    type: "CREATE_TASK",
    title: language === "ar" ? "متابعة السجل تلقائيًا" : "Follow up automatically",
    description: "",
    dueInDays: "2",
    userId: "",
    stageId: "",
    field: "status",
    value: "",
    message: "",
  };
}

function workflowDraft(workflow: any, language: BuilderLanguage): WorkflowDraft {
  const entity = workflow?.entityType || "LEAD";
  const config = workflow?.conditions && typeof workflow.conditions === "object" ? workflow.conditions : {};
  const actions = Array.isArray(workflow?.actions) ? workflow.actions : [];
  return {
    name: workflow?.name || "",
    description: workflow?.description || "",
    entity,
    trigger: workflow?.triggerType || triggerOptions[entity][0].value,
    logic: config.logic === "ANY" ? "ANY" : "ALL",
    conditions: Array.isArray(config.conditions) && config.conditions.length
      ? config.conditions.map((condition: any) => ({ field: condition.field || fieldOptions[entity][0].value, operator: condition.operator || "equals", value: Array.isArray(condition.value) ? condition.value.join(", ") : String(condition.value ?? "") }))
      : [newCondition(entity)],
    actions: actions.length
      ? actions.map((action: any) => {
          const defaults = newAction(language);
          return {
            ...defaults,
            ...action,
            type: action.type === "UPDATE_RECORD" ? "UPDATE_FIELD" : action.type,
            title: String(action.title ?? defaults.title),
            description: String(action.description ?? ""),
            dueInDays: String(action.dueInDays ?? "2"),
            userId: String(action.userId ?? ""),
            stageId: String(action.stageId ?? ""),
            field: String(action.field ?? defaults.field),
            value: Array.isArray(action.value) ? action.value.join(", ") : String(action.value ?? ""),
            message: String(action.message ?? ""),
          };
        })
      : [newAction(language)],
  };
}

export function WorkflowBuilder({
  language,
  members,
  stages,
  workflow,
  onSaved,
  onCancel,
}: {
  language: BuilderLanguage;
  members: WorkflowOption[];
  stages: StageOption[];
  workflow?: any | null;
  onSaved: (workflow: any, isNew: boolean) => void;
  onCancel?: () => void;
}) {
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [form, setForm] = useState(() => workflowDraft(workflow, language));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(workflowDraft(workflow, language));
    setError("");
  }, [workflow, language]);

  const fields = fieldOptions[form.entity] || fieldOptions.LEAD;
  const triggers = triggerOptions[form.entity] || triggerOptions.LEAD;
  const isEditing = Boolean(workflow?.id);

  const updateForm = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const updateCondition = (index: number, patch: Partial<ConditionDraft>) => {
    updateForm({ conditions: form.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  };

  const updateAction = (index: number, patch: Partial<ActionDraft>) => {
    updateForm({ actions: form.actions.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const conditions = form.conditions.map((condition) => {
      const needsValue = !["exists", "not_exists", "is_empty", "is_not_empty"].includes(condition.operator);
      const value = condition.operator === "in" || condition.operator === "not_in"
        ? condition.value.split(",").map((item) => item.trim()).filter(Boolean)
        : condition.value;
      return needsValue ? { field: condition.field, operator: condition.operator, value } : { field: condition.field, operator: condition.operator };
    });
    const actions = form.actions.map((action) => {
      if (action.type === "CREATE_TASK") return { type: action.type, title: action.title.trim(), description: action.description.trim() || undefined, dueInDays: Number(action.dueInDays || 0) };
      if (action.type === "UPDATE_FIELD") {
        const numeric = ["value", "probability"].includes(action.field);
        return { type: action.type, field: action.field, value: numeric ? Number(action.value) : action.value };
      }
      if (action.type === "MOVE_DEAL_STAGE") return { type: action.type, stageId: action.stageId };
      if (action.type === "ASSIGN_OWNER") return { type: action.type, userId: action.userId };
      if (action.type === "CREATE_NOTIFICATION") return { type: action.type, title: action.title.trim(), message: action.message.trim(), ...(action.userId ? { userId: action.userId } : {}) };
      if (action.type === "CREATE_ACTIVITY") return { type: action.type, title: action.title.trim(), description: action.description.trim() || undefined };
      return { type: action.type };
    });
    const payload = { name: form.name.trim(), description: form.description.trim(), entityType: form.entity, triggerType: form.trigger, conditions: { logic: form.logic, conditions }, actions };
    const result = isEditing ? await updateWorkflowAction(workflow.id, payload) : await createWorkflowAction(payload);
    setBusy(false);
    if (!result.success || !result.workflow) {
      setError(result.success ? text("The workflow could not be saved.", "تعذر حفظ سير العمل.") : result.error);
      return;
    }
    onSaved(result.workflow, !isEditing);
  };

  const actionNeedsValue = (operator: string) => !["exists", "not_exists", "is_empty", "is_not_empty"].includes(operator);

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm dark:border-brand-900/60 dark:bg-slate-900">
      <div className="border-b border-slate-100 bg-gradient-to-r from-brand-50/70 to-white p-5 dark:border-slate-800 dark:from-brand-950/30 dark:to-slate-900 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white"><Zap className="h-5 w-5" /></span>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">{isEditing ? text("Edit workflow", "تعديل سير العمل") : text("Create a workflow", "إنشاء سير عمل")}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{text("Define what happens, when it happens, and who receives the next step.", "حدد ماذا يحدث ومتى يحدث ومن يتولى الخطوة التالية.")}</p>
            </div>
          </div>
          {isEditing && onCancel && <button type="button" onClick={onCancel} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6 p-5 sm:p-6">
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">{text("Workflow name", "اسم سير العمل")}
            <input required value={form.name} onChange={(event) => updateForm({ name: event.target.value })} placeholder={text("e.g. Follow up qualified leads", "مثال: متابعة العملاء المحتملين المؤهلين")} className={`${workspaceInput} mt-2`} />
          </label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">{text("Description", "الوصف")}
            <input value={form.description} onChange={(event) => updateForm({ description: event.target.value })} placeholder={text("What is this automation for?", "ما الهدف من هذه الأتمتة؟")} className={`${workspaceInput} mt-2`} />
          </label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">{text("When this record is", "نوع السجل")}
            <select value={form.entity} onChange={(event) => { const entity = event.target.value; updateForm({ entity, trigger: triggerOptions[entity][0].value, conditions: [newCondition(entity)] }); }} className={`${workspaceInput} mt-2`}>
              {entityOptions.map((option) => <option key={option.value} value={option.value}>{textFor(language, option)}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">{text("Trigger event", "الحدث المشغّل")}
            <select value={form.trigger} onChange={(event) => updateForm({ trigger: event.target.value })} className={`${workspaceInput} mt-2`}>
              {triggers.map((option) => <option key={option.value} value={option.value}>{textFor(language, option)}</option>)}
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-bold text-slate-900 dark:text-white">{text("Conditions", "الشروط")}</h3><p className="mt-1 text-xs text-slate-500">{text("The workflow runs only when these rules match.", "يعمل سير العمل فقط عند تحقق هذه الشروط.")}</p></div>
            <div className="flex items-center gap-2"><span className="text-xs font-semibold text-slate-500">{text("Match", "مطابقة")}</span><select value={form.logic} onChange={(event) => updateForm({ logic: event.target.value as "ALL" | "ANY" })} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"><option value="ALL">{text("All", "كل الشروط")}</option><option value="ANY">{text("Any", "أي شرط")}</option></select></div>
          </div>
          <div className="mt-4 space-y-3">
            {form.conditions.map((condition, index) => <div key={index} className="grid gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/40 md:grid-cols-[1fr_1fr_1fr_auto]">
              <select value={condition.field} onChange={(event) => updateCondition(index, { field: event.target.value })} className={workspaceInput}>{fields.map((field) => <option key={field.value} value={field.value}>{textFor(language, field)}</option>)}</select>
              <select value={condition.operator} onChange={(event) => updateCondition(index, { operator: event.target.value })} className={workspaceInput}>{operators.map((operator) => <option key={operator.value} value={operator.value}>{textFor(language, operator)}</option>)}</select>
              {actionNeedsValue(condition.operator) ? <input value={condition.value} onChange={(event) => updateCondition(index, { value: event.target.value })} placeholder={condition.operator === "in" || condition.operator === "not_in" ? text("Separate values with commas", "افصل القيم بفواصل") : text("Value", "القيمة")} className={workspaceInput} /> : <div className="flex items-center rounded-xl border border-dashed border-slate-200 px-3 text-xs text-slate-400 dark:border-slate-700">{text("No value required", "لا تحتاج قيمة")}</div>}
              <button type="button" disabled={form.conditions.length === 1} onClick={() => updateForm({ conditions: form.conditions.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-xl border border-slate-200 px-3 text-slate-500 hover:bg-white disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"><Trash2 className="h-4 w-4" /></button>
            </div>)}
          </div>
          <button type="button" onClick={() => updateForm({ conditions: [...form.conditions, newCondition(form.entity)] })} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-brand-700 hover:underline dark:text-brand-300"><Plus className="h-4 w-4" />{text("Add condition", "إضافة شرط")}</button>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900 dark:text-white">{text("Actions", "الإجراءات")}</h3><p className="mt-1 text-xs text-slate-500">{text("These steps run automatically after the trigger matches.", "هذه الخطوات تنفذ تلقائيًا بعد تحقق الحدث والشروط.")}</p></div></div>
          <div className="mt-4 space-y-4">
            {form.actions.map((action, index) => <div key={index} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/40">
              <div className="flex gap-2"><select value={action.type} onChange={(event) => updateAction(index, { type: event.target.value })} className={`${workspaceInput} flex-1`}>{actionOptions.map((option) => <option key={option.value} value={option.value}>{textFor(language, option)}</option>)}</select><button type="button" disabled={form.actions.length === 1} onClick={() => updateForm({ actions: form.actions.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-xl border border-slate-200 px-3 text-slate-500 hover:bg-white disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"><Trash2 className="h-4 w-4" /></button></div>
              {action.type === "CREATE_TASK" && <div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px]"><input required value={action.title} onChange={(event) => updateAction(index, { title: event.target.value })} placeholder={text("Task title", "عنوان المهمة")} className={workspaceInput} /><label className="relative"><span className="sr-only">{text("Due in days", "بعد كم يوم")}</span><input type="number" min="0" max="3650" value={action.dueInDays} onChange={(event) => updateAction(index, { dueInDays: event.target.value })} placeholder={text("Due in days", "بعد كم يوم")} className={workspaceInput} /></label></div>}
              {action.type === "UPDATE_FIELD" && <div className="mt-3 grid gap-2 md:grid-cols-2"><select value={action.field} onChange={(event) => updateAction(index, { field: event.target.value })} className={workspaceInput}>{fields.map((field) => <option key={field.value} value={field.value}>{textFor(language, field)}</option>)}</select><input required value={action.value} onChange={(event) => updateAction(index, { value: event.target.value })} placeholder={text("New value", "القيمة الجديدة")} className={workspaceInput} /></div>}
              {action.type === "MOVE_DEAL_STAGE" && <select required value={action.stageId} onChange={(event) => updateAction(index, { stageId: event.target.value })} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">{stages.length ? stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.pipelineName} · {stage.name}</option>) : <option value="">{text("No active stages available", "لا توجد مراحل نشطة")}</option>}</select>}
              {action.type === "ASSIGN_OWNER" && <select required value={action.userId} onChange={(event) => updateAction(index, { userId: event.target.value })} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">{text("Choose an owner", "اختر المسؤول")}</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>}
              {action.type === "CREATE_NOTIFICATION" && <div className="mt-3 grid gap-2 md:grid-cols-2"><input required value={action.title} onChange={(event) => updateAction(index, { title: event.target.value })} placeholder={text("Notification title", "عنوان الإشعار")} className={workspaceInput} /><select value={action.userId} onChange={(event) => updateAction(index, { userId: event.target.value })} className={workspaceInput}><option value="">{text("Notify the event owner", "إشعار مسؤول السجل")}</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select><textarea required value={action.message} onChange={(event) => updateAction(index, { message: event.target.value })} placeholder={text("Notification message", "نص الإشعار")} rows={2} className={`${workspaceInput} md:col-span-2`} /></div>}
              {action.type === "CREATE_ACTIVITY" && <div className="mt-3 grid gap-2 md:grid-cols-2"><input required value={action.title} onChange={(event) => updateAction(index, { title: event.target.value })} placeholder={text("Activity title", "عنوان النشاط")} className={workspaceInput} /><input value={action.description} onChange={(event) => updateAction(index, { description: event.target.value })} placeholder={text("Activity details", "تفاصيل النشاط")} className={workspaceInput} /></div>}
              {action.type === "COMPLETE_TASK" && <p className="mt-3 text-xs text-slate-500">{text("This action is available for task workflows and completes the triggered task.", "هذا الإجراء مخصص لمسارات المهام ويكمل المهمة التي شغّلت المسار.")}</p>}
            </div>)}
          </div>
          <button type="button" onClick={() => updateForm({ actions: [...form.actions, newAction(language)] })} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-brand-700 hover:underline dark:text-brand-300"><ListPlus className="h-4 w-4" />{text("Add action", "إضافة إجراء")}</button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {isEditing && onCancel && <button type="button" onClick={onCancel} className={workspaceSecondary}>{text("Cancel", "إلغاء")}</button>}
          <button type="submit" disabled={busy} className={workspaceButton}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? text("Saving...", "جاري الحفظ...") : isEditing ? text("Save changes", "حفظ التعديلات") : text("Create workflow", "إنشاء سير العمل")}</button>
        </div>
      </form>
    </section>
  );
}
