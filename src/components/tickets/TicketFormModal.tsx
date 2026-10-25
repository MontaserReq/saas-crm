"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { createTicketAction } from "@/server/actions/tickets";
import { Modal } from "@/components/ui/Modal";
import { AlertCircle, Check, UserCheck, Users, XCircle } from "lucide-react";

export interface DirectManagerOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface TicketFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTypes?: { id: string; name: string }[];
  /** Used as the default assignment for users without assignment permission. */
  directManager?: DirectManagerOption | null;
  users?: {
    id: string;
    name: string;
    email?: string;
    department?: { name: string } | null;
  }[];
  canAssign?: boolean;
  priorityOptions?: {
    key: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    label: string;
    labelAr: string;
    active?: boolean;
  }[];
  initialClient?: { id: string; name: string } | null;
}

type FormStatus =
  | { kind: "ready"; manager: DirectManagerOption }
  | { kind: "no_manager" }
  | { kind: "manager_disabled"; manager: DirectManagerOption };

export function TicketFormModal({
  isOpen,
  onClose,
  taskTypes = [],
  directManager = null,
  users = [],
  canAssign = false,
  priorityOptions,
  initialClient = null,
}: TicketFormModalProps) {
  const { t, language, errorMessage } = useI18n();
  const router = useRouter();

  const [clientId, setClientId] = useState(initialClient?.id || "");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [taskTypeId, setTaskTypeId] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<
    "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  >("MEDIUM");
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
    setClientId(initialClient?.id || "");
    setAssignedToUserId(canAssign ? "" : directManager?.id || "");
    setTaskTypeId("");
    setSubject("");
    setPriority(
      priorityOptions?.find((item) => item.active !== false)?.key ?? "MEDIUM",
    );
    setDueDate("");
    setInitialNote("");
    setError(null);
  }, [isOpen, priorityOptions, initialClient, canAssign, directManager]);

  const blocked = !canAssign && status.kind !== "ready";
  const activePriorityOptions = (
    priorityOptions?.length
      ? priorityOptions
      : [
          {
            key: "LOW" as const,
            label: t("tickets.priorityLow"),
            labelAr: t("tickets.priorityLow"),
          },
          {
            key: "MEDIUM" as const,
            label: t("tickets.priorityMedium"),
            labelAr: t("tickets.priorityMedium"),
          },
          {
            key: "HIGH" as const,
            label: t("tickets.priorityHigh"),
            labelAr: t("tickets.priorityHigh"),
          },
          {
            key: "URGENT" as const,
            label: t("tickets.priorityUrgent"),
            labelAr: t("tickets.priorityUrgent"),
          },
        ]
  ).filter((item) => item.active !== false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (blocked) return;
    if (subject.trim().length < 3) {
      setError(t("common.error"));
      return;
    }
    if (canAssign && !assignedToUserId) {
      setError(
        language === "ar"
          ? "يرجى اختيار عضو الفريق المكلّف بالتذكرة."
          : "Please select a team member for this ticket.",
      );
      return;
    }
    setLoading(true);
    setError(null);
    const result = await createTicketAction({
      clientId: clientId || null,
      taskTypeId: taskTypeId || null,
      assignedToUserId: assignedToUserId || null,
      subject: subject.trim(),
      priority,
      dueDate: dueDate || null,
      initialNote: initialNote || null,
    });
    setLoading(false);
    if (!result.success) {
      setError(errorMessage(result.error, t("common.error")));
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
        {/* Assignment section: selectable for authorized users,    */}
        {/* otherwise resolved from the current user's manager.     */}
        {/* ====================================================== */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {canAssign
                ? t("tickets.assignTicketTo")
                : t("tickets.directManager")}
            </h3>
          </div>

          {!canAssign && status.kind === "no_manager" && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t("tickets.noDirectManagerBlock")}</span>
            </div>
          )}

          {!canAssign && status.kind === "manager_disabled" && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t("tickets.managerDisabledBlock")}</span>
            </div>
          )}

          {!canAssign && status.kind === "ready" && (
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
              <input
                type="hidden"
                name="directManagerId"
                value={status.manager.id}
              />
            </>
          )}

          {canAssign && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>{t("tickets.selectAssigneePrompt")}</span>
                <span aria-live="polite">
                  {assignedToUserId ? 1 : 0} {language === "ar" ? "مكلّف" : "selected"}
                </span>
              </div>
              <div
                role="radiogroup"
                aria-label={t("tickets.assignTicketTo")}
                className="max-h-40 overflow-y-auto p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 space-y-1"
              >
                {users.map((member) => {
                  const isSelected = assignedToUserId === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setAssignedToUserId(member.id)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-start text-xs transition-colors ${
                        isSelected
                          ? "bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-900 dark:text-brand-200 font-semibold"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent"
                      }`}
                    >
                      <span className="min-w-0 truncate">
                        <span>{member.name}</span>
                        {member.department?.name && (
                          <span className="text-[10px] text-slate-400 ms-1.5">
                            · {member.department.name}
                          </span>
                        )}
                        {member.email && (
                          <span className="block text-[10px] font-normal text-slate-400 truncate">
                            {member.email}
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
                {users.length === 0 && (
                  <p className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {language === "ar"
                      ? "لا يوجد أعضاء فريق مؤهلون لاستقبال التذاكر."
                      : "No eligible team members are available."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ====================================================== */}
        {/* Subject                                                */}
        {/* ====================================================== */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t("tickets.ticketSubject")}{" "}
            <span className="text-rose-500">*</span>
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
        {/* Linked customer / Task Type                            */}
        {/* ====================================================== */}
        {initialClient && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3 text-sm dark:border-brand-900 dark:bg-brand-950/30">
            <span className="text-slate-500 dark:text-slate-400">
              {language === "ar" ? "العميل المرتبط" : "Linked customer"}:{" "}
            </span>
            <span className="font-bold text-brand-700 dark:text-brand-300">
              {initialClient.name}
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3">
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
              {activePriorityOptions.map((item) => (
                <option key={item.key} value={item.key}>
                  {language === "ar" ? item.labelAr : item.label}
                </option>
              ))}
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
