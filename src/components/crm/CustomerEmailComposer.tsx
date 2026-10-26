"use client";

import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { Modal } from "@/components/ui/Modal";
import { sendCustomerEmailAction } from "@/server/actions/customerEmail";

export function CustomerEmailComposer({ recordType, recordId, recipientEmail, canSend }: { recordType: "CLIENT" | "CONTACT" | "LEAD"; recordId: string; recipientEmail?: string | null; canSend: boolean }) {
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500";
  const disabledReason = !canSend ? text("Customer email sending is available on Scale and Enterprise.", "إرسال بريد العملاء متاح ضمن باقتي Scale وEnterprise.") : !recipientEmail ? text("This record has no valid email address.", "لا يوجد بريد إلكتروني صالح لهذا السجل.") : "";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!recipientEmail) return;
    setBusy(true); setError(""); setSuccess("");
    const result = await sendCustomerEmailAction({ recordType, recordId, recipientEmail, subject, bodyText, idempotencyKey: crypto.randomUUID() });
    setBusy(false);
    if (!result.success) { setError(errorMessage(result.error, text("The email could not be sent.", "تعذر إرسال البريد الإلكتروني."))); return; }
    setSuccess(text("The email was accepted by the connected provider and saved to the activity timeline.", "تم قبول الرسالة من مزود البريد المتصل وحفظها في سجل النشاط."));
    setSubject(""); setBodyText("");
  }
  return <>
    <button type="button" disabled={Boolean(disabledReason)} title={disabledReason || undefined} onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"><Mail className="h-3.5 w-3.5 text-brand-200" />{text("Send email", "إرسال بريد")}</button>
    <Modal isOpen={open} onClose={() => !busy && setOpen(false)} title={text("Send customer email", "إرسال بريد للعميل")} closeLabel={text("Close", "إغلاق")} maxWidth="2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800/50">
          <div className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{text("Recipient", "المستلم")}</div>
          <div dir="ltr" className="break-all font-medium text-slate-900 dark:text-slate-100">{recipientEmail || "—"}</div>
        </div>
        {!canSend && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{disabledReason}</p>}
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
        <label htmlFor="customer-email-subject" className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{text("Subject", "الموضوع")}
          <input id="customer-email-subject" required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={text("Enter the email subject", "اكتب موضوع الرسالة")} className={inputClass} />
        </label>
        <label htmlFor="customer-email-body" className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{text("Message", "نص الرسالة")}
          <textarea id="customer-email-body" required maxLength={50_000} rows={8} value={bodyText} onChange={(event) => setBodyText(event.target.value)} placeholder={text("Write your message here...", "اكتب نص الرسالة هنا...")} className={`${inputClass} min-h-40 resize-y leading-7`} />
        </label>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800"><button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{text("Cancel", "إلغاء")}</button><button type="submit" disabled={busy || !canSend || !recipientEmail} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{busy ? text("Sending…", "جارٍ الإرسال…") : text("Send email", "إرسال البريد")}</button></div>
      </form>
    </Modal>
  </>;
}
