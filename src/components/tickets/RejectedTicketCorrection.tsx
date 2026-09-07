'"use client"';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/context";
import { resubmitRejectedTicketAction, updateRejectedTicketAction } from "@/server/actions/tickets";
import { AlertCircle, Pencil, Send } from "lucide-react";

interface Props {
  ticket: { id: string; ticketNumber: string; subject: string; priority: string; dueDate?: string | null; followUpAt?: string | null };
}

export function RejectedTicketCorrection({ ticket }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [subject, setSubject] = useState(ticket.subject);
  const [priority, setPriority] = useState(ticket.priority);
  const [dueDate, setDueDate] = useState(ticket.dueDate ? ticket.dueDate.slice(0, 10) : "");
  const [followUpAt, setFollowUpAt] = useState(ticket.followUpAt ? ticket.followUpAt.slice(0, 16) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitCorrection = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const result = await updateRejectedTicketAction({ ticketId: ticket.id, subject, priority, dueDate: dueDate || null, followUpAt: followUpAt || null });
    setLoading(false);
    if (!result.success) { setError(result.error || t("common.error")); return; }
    setIsOpen(false);
    router.refresh();
  };

  const resubmit = async () => {
    setLoading(true);
    setError(null);
    const result = await resubmitRejectedTicketAction(ticket.id);
    setLoading(false);
    if (!result.success) { setError(result.error || t("common.error")); return; }
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      {error && <div className="basis-full flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300"><AlertCircle className="w-4 h-4" />{error}</div>}
      <button type="button" onClick={() => setIsOpen(true)} disabled={loading} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800">
        <Pencil className="w-3.5 h-3.5" />
        {t("tickets.rejectedCorrectInfo")}
      </button>
      <button type="button" onClick={resubmit} disabled={loading} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50">
        <Send className="w-3.5 h-3.5" />
        {t("tickets.resubmitTicket")}
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t("tickets.rejectedCorrectTitle")} description={t("tickets.oldNewValuesSavedInActivity")}>
        <form onSubmit={submitCorrection} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1">{t("tickets.subject")}</label>
            <input required minLength={3} value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">{t("tickets.priority")}</label>
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1">{t("tickets.dueDate")}</label>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">{t("tickets.followUp")}</label>
              <input type="datetime-local" value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 rounded-lg text-sm">{t("tickets.cancel")}</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-brand-600 disabled:opacity-50">{loading ? t("common.loading") : t("tickets.save")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}