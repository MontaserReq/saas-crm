"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { decideSchoolApprovalAction } from "@/server/actions/schools";
import { useI18n } from "@/lib/i18n/context";

export function ApprovalRequestsClient({ requests }: { requests: any[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    await decideSchoolApprovalAction(id, approve);
    setBusy(null);
    router.refresh();
  };
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{t("admin.approvalRequests.title")}</h2>
        <p className="text-xs text-slate-500">{t("admin.approvalRequests.subtitle")}</p>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="hidden md:table-row bg-slate-50 dark:bg-slate-800 text-start">
              <th className="p-3">{t("admin.approvalRequests.tableSchool")}</th>
              <th className="p-3">{t("admin.approvalRequests.tableType")}</th>
              <th className="p-3">{t("admin.approvalRequests.tableStatus")}</th>
              <th className="p-3">{t("admin.approvalRequests.tableRequester")}</th>
              <th className="p-3">{t("admin.approvalRequests.tableRequested")}</th>
              <th className="p-3">{t("admin.approvalRequests.tableActions")}</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => {
              const statusBadge = (
                <span className="inline-flex px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                  🟡 {request.status === "PENDING" ? t("admin.approvalRequests.pendingApproval") : request.status}
                </span>
              );
              const actionButtons = (
                <>
                  <button disabled={busy === request.id} onClick={() => decide(request.id, true)} className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700"><Check className="w-4 h-4" /></button>
                  <button disabled={busy === request.id} onClick={() => decide(request.id, false)} className="p-2.5 rounded-lg bg-rose-50 text-rose-700"><X className="w-4 h-4" /></button>
                </>
              );
              return (
                <React.Fragment key={request.id}>
                  {/* Desktop row */}
                  <tr className="hidden md:table-row border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-bold">{request.school.name}</td>
                    <td className="p-3">{request.type}</td>
                    <td className="p-3">{statusBadge}</td>
                    <td className="p-3">{request.requester.name}</td>
                    <td className="p-3">{new Date(request.createdAt).toLocaleString()}</td>
                    <td className="p-3 flex gap-2">{actionButtons}</td>
                  </tr>

                  {/* Mobile card */}
                  <tr className="md:hidden border-t border-slate-100 dark:border-slate-800">
                    <td colSpan={6} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold truncate">{request.school.name}</span>
                        {statusBadge}
                      </div>
                      <div className="text-slate-500">{request.type}</div>
                      <div className="flex items-center justify-between gap-2 text-slate-500">
                        <span>{request.requester.name}</span>
                        <span>{new Date(request.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">{actionButtons}</div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {requests.length === 0 && <p className="p-8 text-center text-slate-400">{t("admin.approvalRequests.noPendingRequests")}</p>}
      </div>
    </div>
  );
}