"use client";

import { useI18n } from "@/lib/i18n/context";
import { ResumeWorkflowExecutionButton } from "./ResumeWorkflowExecutionButton";

type WorkflowExecutionRow = {
  id: string;
  status: string;
  eventType: string;
  entityType: string;
  entityId: string;
  startedAt: string | null;
  errorMessage: string | null;
};

const resumableStatuses = ["PENDING", "RUNNING", "PAUSED_ENTITLEMENT"];

export function WorkflowExecutionsView({
  executions,
  canResume,
}: {
  executions: WorkflowExecutionRow[];
  canResume: boolean;
}) {
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const labels: Record<string, [string, string]> = {
    PENDING: ["Pending", "قيد الانتظار"],
    RUNNING: ["Running", "قيد التنفيذ"],
    COMPLETED: ["Completed", "مكتمل"],
    FAILED: ["Failed", "فشل"],
    PAUSED_ENTITLEMENT: ["Paused — plan limitation", "متوقف — قيود الخطة"],
    LEAD_STATUS_CHANGED: ["Lead status changed", "تغيرت حالة العميل المحتمل"],
    RECORD_CREATED: ["Record created", "تم إنشاء سجل"],
    RECORD_UPDATED: ["Record updated", "تم تحديث سجل"],
    LEAD: ["Lead", "عميل محتمل"],
    CLIENT: ["Customer", "عميل"],
    CONTACT: ["Contact", "جهة اتصال"],
    DEAL: ["Deal", "صفقة"],
    TASK: ["Task", "مهمة"],
    TICKET: ["Ticket", "تذكرة"],
  };
  const label = (value: string) =>
    labels[value]?.[ar ? 1 : 0] ??
    (ar ? "غير معروف" : value.replaceAll("_", " ").toLowerCase());

  return (
    <main dir={ar ? "rtl" : "ltr"} className="space-y-5">
      <h1 className="text-2xl font-bold">
        {text("Workflow execution history", "سجل تنفيذ سير العمل")}
      </h1>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-start">
              <th className="p-3 text-start">{text("Status", "الحالة")}</th>
              <th className="p-3 text-start">{text("Event", "الحدث")}</th>
              <th className="p-3 text-start">{text("Entity", "السجل")}</th>
              <th className="p-3 text-start">{text("Started", "بدأ في")}</th>
              <th className="p-3 text-start">{text("Error", "الخطأ")}</th>
              <th className="p-3 text-start">
                {text("Recovery", "الاستئناف")}
              </th>
            </tr>
          </thead>
          <tbody>
            {executions.map((execution) => (
              <tr key={execution.id} className="border-b">
                <td className="p-3">{label(execution.status)}</td>
                <td className="p-3">{label(execution.eventType)}</td>
                <td className="p-3">
                  {label(execution.entityType)} / {execution.entityId}
                </td>
                <td className="p-3">
                  {execution.startedAt
                    ? new Intl.DateTimeFormat(ar ? "ar-JO" : "en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(execution.startedAt))
                    : "—"}
                </td>
                <td className="p-3 text-red-600">
                  {execution.errorMessage
                    ? errorMessage(execution.errorMessage)
                    : "—"}
                </td>
                <td className="p-3">
                  {canResume && resumableStatuses.includes(execution.status) ? (
                    <ResumeWorkflowExecutionButton executionId={execution.id} />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!executions.length && (
          <p className="p-6 text-sm text-slate-500">
            {text("No executions yet.", "لا توجد عمليات تنفيذ حتى الآن.")}
          </p>
        )}
      </div>
    </main>
  );
}
