"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { decideSchoolApprovalAction } from "@/server/actions/schools";
import { decideTicketApprovalAction } from "@/server/actions/tickets";
import { useI18n } from "@/lib/i18n/context";
import { decideOperationApprovalAction } from "@/server/actions/approvals";

export function ApprovalRequestsClient({ requests }: { requests: any[] }) {
  const { t, language, getStatusLabel } = useI18n();
  const ar = language === "ar";
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    const request = requests.find((item) => item.id === id);
    if (request?.kind === "TICKET")
      await decideTicketApprovalAction(id, approve);
    else if (request?.kind === "OPERATION")
      await decideOperationApprovalAction(id, approve);
    else await decideSchoolApprovalAction(id, approve);
    setBusy(null);
    router.refresh();
  };
  const requestTitle = (request: any) => {
    if (request.kind === "TICKET")
      return `${request.ticket.ticketNumber} — ${request.ticket.subject}`;
    if (request.kind === "OPERATION")
      return request.entityLabel || request.resourceType.replaceAll("_", " ");
    return request.school.name;
  };
  const requestType = (request: any) => {
    if (request.kind === "TICKET")
      return t(
        `admin.approvalRequests.ticketType.${request.type.toLowerCase()}`,
      );
    if (request.kind === "OPERATION") {
      const resources: Record<string, string> = {
        CLIENT: "عميل",
        LEAD: "عميل محتمل",
        CONTACT: "جهة اتصال",
        DEAL: "صفقة",
        TASK: "مهمة",
        TICKET: "تذكرة",
      };
      const operations: Record<string, string> = {
        CREATE: "إنشاء",
        UPDATE: "تعديل",
        DELETE: "حذف",
      };
      return ar
        ? `${resources[request.resourceType] || "سجل"} · ${operations[request.operation] || "عملية"}`
        : `${request.resourceType.replaceAll("_", " ")} · ${request.operation}`;
    }
    return getStatusLabel(request.type);
  };
  const operationDetails = (request: any) => {
    if (request.kind !== "OPERATION") return null;
    if (ar) {
      return (
        <p className="rounded-xl border bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/60">
          سيتم تطبيق بيانات الطلب بعد الموافقة.
        </p>
      );
    }
    try {
      const payload = JSON.parse(request.payload);
      const values = payload.input || payload.data || payload;
      return (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border bg-slate-50 p-3 text-[11px] leading-5 dark:border-slate-700 dark:bg-slate-800/60">
          {JSON.stringify(values, null, 2)}
        </pre>
      );
    } catch {
      return null;
    }
  };
  const editComparison = (request: any) => {
    if (request.kind !== "TICKET" || request.type !== "EDIT") return null;
    try {
      const payload = JSON.parse(request.proposedData);
      const previous = payload.previous || {};
      const proposed = payload.proposed || {};
      const formatDate = (value: string | null) =>
        value ? new Date(value).toLocaleString(ar ? "ar-JO" : "en-US") : "—";
      const rows = [
        [t("tickets.subject"), previous.subject, proposed.subject],
        [t("tickets.priority"), previous.priority, proposed.priority],
        [
          t("schools.schoolName"),
          request.ticket.school?.name || "—",
          payload.display?.schoolName || "—",
        ],
        [
          t("tickets.taskType"),
          request.ticket.taskType?.name || "—",
          payload.display?.taskTypeName || "—",
        ],
        [
          t("tickets.dueDate"),
          formatDate(previous.dueDate),
          formatDate(proposed.dueDate),
        ],
        [
          t("tickets.followUp"),
          formatDate(previous.followUpAt),
          formatDate(proposed.followUpAt),
        ],
      ].filter(([, before, after]) => before !== after);
      return (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="grid grid-cols-[minmax(7rem,0.7fr)_1fr_1fr] gap-2 text-[11px] font-bold text-slate-500">
            <span>{t("admin.approvalRequests.field")}</span>
            <span>{t("admin.approvalRequests.currentValue")}</span>
            <span>{t("admin.approvalRequests.proposedValue")}</span>
          </div>
          {rows.map(([label, before, after]) => (
            <div
              key={String(label)}
              className="grid grid-cols-[minmax(7rem,0.7fr)_1fr_1fr] gap-2 border-t border-slate-200 pt-2 text-xs dark:border-slate-700"
            >
              <span className="font-bold">{label}</span>
              <span className="break-words text-slate-500">
                {before || "—"}
              </span>
              <span className="break-words font-semibold text-brand-700 dark:text-brand-300">
                {after || "—"}
              </span>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-2 text-xs dark:border-slate-700">
            <span className="font-bold">{t("tickets.changeReason")}: </span>
            <span className="text-slate-600 dark:text-slate-300">
              {payload.changeReason}
            </span>
          </div>
        </div>
      );
    } catch {
      return (
        <p className="text-xs text-rose-600">
          {t("admin.approvalRequests.invalidProposal")}
        </p>
      );
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">
          {t("admin.approvalRequests.title")}
        </h2>
        <p className="text-xs text-slate-500">
          {t("admin.approvalRequests.subtitle")}
        </p>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="hidden md:table-row bg-slate-50 dark:bg-slate-800 text-start">
              <th className="p-3">{t("admin.approvalRequests.tableSchool")}</th>
              <th className="p-3">{t("admin.approvalRequests.tableType")}</th>
              <th className="p-3">{t("admin.approvalRequests.tableStatus")}</th>
              <th className="p-3">
                {t("admin.approvalRequests.tableRequester")}
              </th>
              <th className="p-3">
                {t("admin.approvalRequests.tableRequested")}
              </th>
              <th className="p-3">
                {t("admin.approvalRequests.tableActions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => {
              const statusBadge = (
                <span className="inline-flex px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                  🟡{" "}
                  {request.status === "PENDING"
                    ? t("admin.approvalRequests.pendingApproval")
                    : getStatusLabel(request.status)}
                </span>
              );
              const actionButtons = (
                <>
                  <button
                    disabled={busy === request.id}
                    onClick={() => decide(request.id, true)}
                    className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    disabled={busy === request.id}
                    onClick={() => decide(request.id, false)}
                    className="p-2.5 rounded-lg bg-rose-50 text-rose-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              );
              return (
                <React.Fragment key={request.id}>
                  {/* Desktop row */}
                  <tr className="hidden md:table-row border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-bold">{requestTitle(request)}</td>
                    <td className="p-3">{requestType(request)}</td>
                    <td className="p-3">{statusBadge}</td>
                    <td className="p-3">{request.requester.name}</td>
                    <td className="p-3">
                      {new Date(request.createdAt).toLocaleString(
                        ar ? "ar-JO" : "en-US",
                      )}
                    </td>
                    <td className="p-3 flex gap-2">{actionButtons}</td>
                  </tr>
                  {request.kind === "TICKET" && request.type === "EDIT" && (
                    <tr className="hidden md:table-row bg-slate-50/60 dark:bg-slate-900/60">
                      <td colSpan={6} className="p-3">
                        {editComparison(request)}
                      </td>
                    </tr>
                  )}
                  {request.kind === "OPERATION" && (
                    <tr className="hidden md:table-row bg-slate-50/60 dark:bg-slate-900/60">
                      <td colSpan={6} className="p-3">
                        {operationDetails(request)}
                      </td>
                    </tr>
                  )}

                  {/* Mobile card */}
                  <tr className="md:hidden border-t border-slate-100 dark:border-slate-800">
                    <td colSpan={6} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold truncate">
                          {requestTitle(request)}
                        </span>
                        {statusBadge}
                      </div>
                      <div className="text-slate-500">
                        {requestType(request)}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-slate-500">
                        <span>{request.requester.name}</span>
                        <span>
                          {new Date(request.createdAt).toLocaleString(
                            ar ? "ar-JO" : "en-US",
                          )}
                        </span>
                      </div>
                      {editComparison(request)}
                      {operationDetails(request)}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {actionButtons}
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {requests.length === 0 && (
          <p className="p-8 text-center text-slate-400">
            {t("admin.approvalRequests.noPendingRequests")}
          </p>
        )}
      </div>
    </div>
  );
}
