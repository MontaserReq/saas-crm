﻿"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { createTicketAction } from "@/server/actions/tickets";
import { Modal } from "@/components/ui/Modal";
import { AlertCircle, UserCheck, XCircle } from "lucide-react";

export interface DirectManagerOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface TicketFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools?: { id: string; name: string }[];
  taskTypes?: { id: string; name: string }[];
  /**
   * The current authenticated user's direct manager (User.reportsToUserId).
   * This is fetched server-side and is the ONLY source for ticket assignment.
   * The user MUST NOT be able to select a different assignee from the UI.
   */
  directManager?: DirectManagerOption | null;
}

type FormStatus =
  | { kind: "ready"; manager: DirectManagerOption }
  | { kind: "no_manager" }
  | { kind: "manager_disabled"; manager: DirectManagerOption };

export function TicketFormModal({
  isOpen,
  onClose,
  schools = [],
  taskTypes = [],
  directManager = null,
}: TicketFormModalProps) {
  const { t } = useI18n();
  const router = useRouter();

  const [schoolId, setSchoolId] = useState("");
  const [taskTypeId, setTaskTypeId] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [initialNote, setInitialNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Compute form status from the server-provided direct manager.
  const status: FormStatus = !directManager
    ? { kind: "no_manager" }
    : !directManager.isActive
    ? { kind: "manager_disabled", manager: directManager }
    : { kind: "ready", manager: directManager };

  // Reset form when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSchoolId("");
    setTaskTypeId("");
    setSubject("");
    setPriority("MEDIUM");
    setDueDate("");
    setInitialNote("");
    setError(null);
  }, [isOpen]);

  const blocked = status.kind !== "ready";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (blocked) return;
    if (subject.trim().length < 3) {
      setError(t("common.error"));
      return;
    }
    setLoading(true);
    setError(null);
    // IMPORTANT: assignedToUserId is intentionally NOT sent.
    // The server derives the assignee from currentUser.reportsToUserId.
    const result = await createTicketAction({
      schoolId: schoolId || null,
      taskTypeId: taskTypeId || null,
      subject: subject.trim(),
      priority,
      dueDate: dueDate || null,
      initialNote: initialNote || null,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error || t("common.error"));
      return;
    }
    onClose();
    router.refresh();
    if (result.ticketId) router.push(`/tickets/${result.ticketId}`);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("tickets.newTicket")}
      description={t("tickets.allTicketsSubtitle")}
      maxWidth="2xl"
    >
      <form onSubmit={submit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ====================================================== */}
        {/* Direct Manager section (READ-ONLY, server-driven)       */}
        {/* ====================================================== */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {t("tickets.directManager")}
            </h3>
          </div>

          {status.kind === "no_manager" && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t("tickets.noDirectManagerBlock")}</span>
            </div>
          )}

          {status.kind === "manager_disabled" && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t("tickets.managerDisabledBlock")}</span>
            </div>
          )}

          {status.kind === "ready" && (
            <>
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold text-sm">
                  {status.manager.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {status.manager.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t("tickets.directManagerDesc")}
                  </p>
                </div>
              </div>
              <input type="hidden" name="directManagerId" value={status.manager.id} />
            </>
          )}
        </div>

        {/* ====================================================== */}
        {/* Subject                                                */}
        {/* ====================================================== */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t("tickets.ticketSubject")} <span className="text-rose-500">*</span>
          </label>
          <input
            required
            minLength={3}
            disabled={blocked}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("tickets.subjectPlaceholder")}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
          />
        </div>

        {/* ====================================================== */}
        {/* School / Task Type                                     */}
        {/* ====================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t("tickets.schoolOptional")}
            </label>
            <select
              disabled={blocked}
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
            >
              <option value="">{t("tickets.schoolOptional")}</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t("tickets.taskTypeOptional")}
            </label>
            <select
              disabled={blocked}
              value={taskTypeId}
              onChange={(e) => setTaskTypeId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
            >
              <option value="">{t("tickets.taskTypeOptional")}</option>
              {taskTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>
                  {tt.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ====================================================== */}
        {/* Priority / Due Date                                    */}
        {/* ====================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t("tickets.selectPriority")}
            </label>
            <select
              disabled={blocked}
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
            >
              <option value="LOW">{t("tickets.priorityLow")}</option>
              <option value="MEDIUM">{t("tickets.priorityMedium")}</option>
              <option value="HIGH">{t("tickets.priorityHigh")}</option>
              <option value="URGENT">{t("tickets.priorityUrgent")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t("tickets.dueDateLabel")}
            </label>
            <input
              type="date"
              disabled={blocked}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
            />
          </div>
        </div>

        {/* ====================================================== */}
        {/* Initial Note                                           */}
        {/* ====================================================== */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t("tickets.initialNote")}
          </label>
          <textarea
            rows={3}
            disabled={blocked}
            value={initialNote}
            onChange={(e) => setInitialNote(e.target.value)}
            placeholder={t("tickets.initialNotePlaceholder")}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
          />
        </div>

        {/* ====================================================== */}
        {/* Actions                                                */}
        {/* ====================================================== */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={loading || blocked}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? t("common.loading") : t("tickets.createTicketAssign")}
          </button>
        </div>
      </form>
    </Modal>
  );
}