"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { createMeetingTicketAction } from "@/server/actions/tickets";
import { Modal } from "@/components/ui/Modal";
import { AlertCircle, UserCheck, XCircle, Plus, X, ListChecks, Users as UsersIcon } from "lucide-react";
import type { DirectManagerOption } from "@/components/tickets/TicketFormModal";

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface ParticipantDraft {
  name: string;
  userId?: string | null;
}

interface ActionItemDraft {
  text: string;
  assigneeId?: string | null;
}

interface MeetingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools?: { id: string; name: string }[];
  taskTypes?: { id: string; name: string }[];
  users?: UserOption[];
  directManager?: DirectManagerOption | null;
}

type FormStatus =
  | { kind: "ready"; manager: DirectManagerOption }
  | { kind: "no_manager" }
  | { kind: "manager_disabled"; manager: DirectManagerOption };

export function MeetingFormModal({
  isOpen,
  onClose,
  schools = [],
  taskTypes = [],
  users = [],
  directManager = null,
}: MeetingFormModalProps) {
  const { t } = useI18n();
  const router = useRouter();

  const [schoolId, setSchoolId] = useState("");
  const [taskTypeId, setTaskTypeId] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
  const [participantUserId, setParticipantUserId] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [actionItems, setActionItems] = useState<ActionItemDraft[]>([]);
  const [actionItemText, setActionItemText] = useState("");
  const [actionItemAssigneeId, setActionItemAssigneeId] = useState("");
  const [minutes, setMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const status: FormStatus = !directManager
    ? { kind: "no_manager" }
    : !directManager.isActive
    ? { kind: "manager_disabled", manager: directManager }
    : { kind: "ready", manager: directManager };

  useEffect(() => {
    if (!isOpen) return;
    setSchoolId("");
    setTaskTypeId("");
    setSubject("");
    setPriority("MEDIUM");
    setMeetingDate("");
    setMeetingTime("");
    setParticipants([]);
    setParticipantUserId("");
    setParticipantName("");
    setActionItems([]);
    setActionItemText("");
    setActionItemAssigneeId("");
    setMinutes("");
    setError(null);
  }, [isOpen]);

  const blocked = status.kind !== "ready";

  function addParticipant() {
    if (participantUserId) {
      const u = users.find((x) => x.id === participantUserId);
      if (!u) return;
      if (participants.some((p) => p.userId === u.id)) return;
      setParticipants((prev) => [...prev, { name: u.name, userId: u.id }]);
      setParticipantUserId("");
      return;
    }
    const name = participantName.trim();
    if (!name) return;
    setParticipants((prev) => [...prev, { name }]);
    setParticipantName("");
  }

  function removeParticipant(index: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  function addActionItem() {
    const text = actionItemText.trim();
    if (!text) return;
    setActionItems((prev) => [...prev, { text, assigneeId: actionItemAssigneeId || null }]);
    setActionItemText("");
    setActionItemAssigneeId("");
  }

  function removeActionItem(index: number) {
    setActionItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (blocked) return;
    if (subject.trim().length < 3) {
      setError(t("tickets.meetingTitleRequired"));
      return;
    }
    if (!meetingDate || !meetingTime) {
      setError(t("tickets.meetingDateTimeRequired"));
      return;
    }
    if (participants.length === 0) {
      setError(t("tickets.meetingParticipantRequired"));
      return;
    }

    setLoading(true);
    setError(null);
    const result = await createMeetingTicketAction({
      schoolId: schoolId || null,
      taskTypeId: taskTypeId || null,
      subject: subject.trim(),
      priority,
      meetingDate,
      meetingTime,
      participants,
      actionItems: actionItems.map((a) => ({ text: a.text, assigneeId: a.assigneeId, done: false })),
      initialNote: minutes.trim() || null,
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
      title={t("tickets.newMeeting")}
      description={t("tickets.newMeetingDesc")}
      maxWidth="2xl"
    >
      <form onSubmit={submit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

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
            <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
              <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold text-sm">
                {status.manager.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{status.manager.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("tickets.directManagerDesc")}</p>
              </div>
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t("tickets.meetingTitle")} <span className="text-rose-500">*</span>
          </label>
          <input
            required
            minLength={3}
            disabled={blocked}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("tickets.meetingTitlePlaceholder")}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
          />
        </div>

        {/* Date / Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t("tickets.meetingDate")} <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              disabled={blocked}
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t("tickets.meetingTime")} <span className="text-rose-500">*</span>
            </label>
            <input
              type="time"
              required
              disabled={blocked}
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
            />
          </div>
        </div>

        {/* School / Task Type */}
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
                <option key={s.id} value={s.id}>{s.name}</option>
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
                <option key={tt.id} value={tt.id}>{tt.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Priority */}
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

        {/* Participants */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {t("tickets.participants")} <span className="text-rose-500">*</span>
            </h3>
          </div>

          {participants.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {participants.map((p, idx) => (
                <span
                  key={`${p.userId || p.name}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs font-semibold text-brand-700 dark:text-brand-300"
                >
                  <span>{p.name}</span>
                  <button type="button" disabled={blocked} onClick={() => removeParticipant(idx)} className="hover:text-rose-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
            <select
              disabled={blocked}
              value={participantUserId}
              onChange={(e) => { setParticipantUserId(e.target.value); setParticipantName(""); }}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:border-brand-500 focus:outline-none disabled:opacity-60"
            >
              <option value="">{t("tickets.selectTeamMember")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
            <input
              disabled={blocked || !!participantUserId}
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder={t("tickets.externalParticipantPlaceholder")}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:border-brand-500 focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              disabled={blocked}
              onClick={addParticipant}
              className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("common.add")}</span>
            </button>
          </div>
        </div>

        {/* Action Items */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t("tickets.actionItems")}</h3>
          </div>

          {actionItems.length > 0 && (
            <ul className="space-y-1.5">
              {actionItems.map((a, idx) => {
                const assignee = users.find((u) => u.id === a.assigneeId);
                return (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <span className="text-slate-700 dark:text-slate-300">
                      {a.text}
                      {assignee && <span className="text-slate-400"> — {assignee.name}</span>}
                    </span>
                    <button type="button" disabled={blocked} onClick={() => removeActionItem(idx)} className="text-slate-400 hover:text-rose-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
            <input
              disabled={blocked}
              value={actionItemText}
              onChange={(e) => setActionItemText(e.target.value)}
              placeholder={t("tickets.actionItemPlaceholder")}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:border-brand-500 focus:outline-none disabled:opacity-60"
            />
            <select
              disabled={blocked}
              value={actionItemAssigneeId}
              onChange={(e) => setActionItemAssigneeId(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:border-brand-500 focus:outline-none disabled:opacity-60"
            >
              <option value="">{t("tickets.selectAssignee")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={blocked}
              onClick={addActionItem}
              className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("common.add")}</span>
            </button>
          </div>
        </div>

        {/* Meeting Minutes / Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {t("tickets.meetingMinutes")}
          </label>
          <textarea
            rows={4}
            disabled={blocked}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder={t("tickets.meetingMinutesPlaceholder")}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
          />
          <p className="text-[11px] text-slate-400 mt-1">{t("tickets.meetingAttachmentsHint")}</p>
        </div>

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
            {loading ? t("common.loading") : t("tickets.createMeeting")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
