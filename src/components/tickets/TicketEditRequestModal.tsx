"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Pencil, Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/context";
import { requestTicketEditAction } from "@/server/actions/tickets";

type TicketEditValues = {
  schoolId: string | null;
  taskTypeId: string | null;
  subject: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  followUpAt: string | null;
};

interface Props {
  ticket: TicketEditValues & { id: string; ticketNumber: string };
  schools: Array<{ id: string; name: string }>;
  taskTypes: Array<{ id: string; name: string }>;
  currentUserId: string;
  canRequestEdit: boolean;
  pendingRequest?: {
    id: string;
    requesterId: string;
    proposedData: string;
    createdAt: string | Date;
  } | null;
}

function dateValue(value: string | Date | null | undefined, length: 10 | 16) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString().slice(0, length);
}

function pendingPayload(request?: Props["pendingRequest"]) {
  if (!request) return null;
  try {
    return JSON.parse(request.proposedData) as {
      proposed?: TicketEditValues;
      changeReason?: string;
    };
  } catch {
    return null;
  }
}

export function TicketEditRequestModal({
  ticket,
  schools,
  taskTypes,
  currentUserId,
  canRequestEdit,
  pendingRequest,
}: Props) {
  const { t, errorMessage } = useI18n();
  const router = useRouter();
  const existing = useMemo(
    () => pendingPayload(pendingRequest),
    [pendingRequest],
  );
  const canRevisePending = pendingRequest?.requesterId === currentUserId;
  const [open, setOpen] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  const [taskTypeId, setTaskTypeId] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] =
    useState<TicketEditValues["priority"]>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const source = existing?.proposed || ticket;
    setSchoolId(source.schoolId || "");
    setTaskTypeId(source.taskTypeId || "");
    setSubject(source.subject);
    setPriority(source.priority);
    setDueDate(dateValue(source.dueDate, 10));
    setFollowUpAt(dateValue(source.followUpAt, 16));
    setChangeReason(existing?.changeReason || "");
    setError(null);
  }, [existing, open, ticket]);

  if (!canRequestEdit && !pendingRequest) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const result = await requestTicketEditAction({
      ticketId: ticket.id,
      schoolId: schoolId || null,
      taskTypeId: taskTypeId || null,
      subject,
      priority,
      dueDate: dueDate || null,
      followUpAt: followUpAt || null,
      changeReason,
    });
    setLoading(false);
    if (!result.success) {
      setError(errorMessage(result.error, t("common.error")));
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pendingRequest && (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <Clock3 className="h-3.5 w-3.5" />
          {t("tickets.editPendingReview")}
        </span>
      )}
      {canRequestEdit && (!pendingRequest || canRevisePending) && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2 text-xs font-bold text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300"
        >
          <Pencil className="h-3.5 w-3.5" />
          {pendingRequest
            ? t("tickets.reviseEditRequest")
            : t("tickets.requestEdit")}
        </button>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t("tickets.requestEditTitle")}
        description={t("tickets.requestEditDescription")}
      >
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold">
              <span className="mb-1 block">{t("tickets.schoolOptional")}</span>
              <select
                value={schoolId}
                onChange={(event) => setSchoolId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">{t("tickets.schoolOptional")}</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold">
              <span className="mb-1 block">
                {t("tickets.taskTypeOptional")}
              </span>
              <select
                value={taskTypeId}
                onChange={(event) => setTaskTypeId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">{t("tickets.taskTypeOptional")}</option>
                {taskTypes.map((taskType) => (
                  <option key={taskType.id} value={taskType.id}>
                    {taskType.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs font-bold">
            <span className="mb-1 block">{t("tickets.subject")}</span>
            <input
              required
              minLength={3}
              maxLength={200}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="block text-xs font-bold">
            <span className="mb-1 block">{t("tickets.priority")}</span>
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as TicketEditValues["priority"])
              }
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="LOW">{t("tickets.priorityLow")}</option>
              <option value="MEDIUM">{t("tickets.priorityMedium")}</option>
              <option value="HIGH">{t("tickets.priorityHigh")}</option>
              <option value="URGENT">{t("tickets.priorityUrgent")}</option>
            </select>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold">
              <span className="mb-1 block">{t("tickets.dueDate")}</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="text-xs font-bold">
              <span className="mb-1 block">{t("tickets.followUp")}</span>
              <input
                type="datetime-local"
                value={followUpAt}
                onChange={(event) => setFollowUpAt(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
          </div>
          <label className="block text-xs font-bold">
            <span className="mb-1 block">{t("tickets.changeReason")}</span>
            <textarea
              required
              minLength={3}
              maxLength={1000}
              rows={3}
              value={changeReason}
              onChange={(event) => setChangeReason(event.target.value)}
              placeholder={t("tickets.changeReasonPlaceholder")}
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {loading ? t("common.loading") : t("tickets.submitForReview")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
