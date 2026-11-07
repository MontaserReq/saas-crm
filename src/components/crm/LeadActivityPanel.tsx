"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLeadActivityAction } from "@/server/actions/lead-activities";
import { useI18n } from "@/lib/i18n/context";

export function LeadActivityPanel({ leadId, initialActivities, canUpdate }: { leadId: string; initialActivities: any[]; canUpdate: boolean }) {
  const { language } = useI18n();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const router = useRouter();
  const [type, setType] = useState<"NOTE" | "CALL" | "EMAIL" | "WHATSAPP">("NOTE");
  const [content, setContent] = useState("");
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await createLeadActivityAction(leadId, { type, content, outcome: outcome || null });
    setBusy(false);
    if (!result.success) { setMessage(result.error); return; }
    setContent(""); setOutcome(""); setMessage(text("Activity recorded.", "تم تسجيل النشاط.")); router.refresh();
  }
  return <section className="rounded border p-4">
    <h2 className="font-semibold">{text("Notes and communication log", "سجل الملاحظات والتواصل")}</h2>
    {canUpdate && <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[150px_1fr_180px_auto]">
      <select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="rounded-xl border p-2 text-sm"><option value="NOTE">{text("Note", "ملاحظة")}</option><option value="CALL">{text("Call", "مكالمة")}</option><option value="EMAIL">{text("Email", "بريد")}</option><option value="WHATSAPP">WhatsApp</option></select>
      <input required value={content} onChange={(event) => setContent(event.target.value)} placeholder={text("What happened?", "ماذا حدث؟")} className="rounded-xl border p-2 text-sm" />
      <input value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder={text("Outcome (optional)", "النتيجة (اختياري)")} className="rounded-xl border p-2 text-sm" />
      <button disabled={busy} className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{text("Save", "حفظ")}</button>
    </form>}
    {message && <p className="mt-2 text-xs text-violet-700">{message}</p>}
    <div className="mt-4 space-y-2">{initialActivities.length ? initialActivities.map((activity) => <div key={activity.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900"><div className="flex justify-between gap-3"><span className="font-bold">{activity.type}</span><time className="text-xs text-slate-500">{new Date(activity.createdAt).toLocaleString(ar ? "ar-JO" : "en-US")}</time></div><p className="mt-1">{activity.content || activity.outcome || "—"}</p><p className="mt-1 text-xs text-slate-500">{activity.actor?.name || "—"}{activity.outcome ? ` · ${activity.outcome}` : ""}</p></div>) : <p className="text-sm text-slate-500">{text("No lead activity yet.", "لا يوجد نشاط لهذا العميل بعد.")}</p>}</div>
  </section>;
}
