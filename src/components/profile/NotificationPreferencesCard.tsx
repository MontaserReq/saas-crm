"use client";

import { useState } from "react";
import { Bell, Mail, Save } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { updateNotificationPreferencesAction } from "@/server/actions/notificationPreferences";

const labels: Record<string, [string, string]> = {
  TICKET_ASSIGNED: ["Ticket assignments", "إسناد التذاكر"],
  TICKET_TRANSFERRED: ["Ticket transfers", "تحويل التذاكر"],
  NEW_MESSAGE: ["Internal messages", "الرسائل الداخلية"],
  MENTION: ["Mentions", "الإشارات"],
  WORKFLOW: ["Workflow notifications", "إشعارات سير العمل"],
  SCHOOL_APPROVAL_REQUESTED: ["Approval requests", "طلبات الموافقة"],
};

export function NotificationPreferencesCard({ initial }: { initial: { inAppEnabled: boolean; emailEnabled: boolean; categories: Record<string, boolean> } }) {
  const { language } = useI18n();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [inAppEnabled, setInAppEnabled] = useState(initial.inAppEnabled);
  const [emailEnabled, setEmailEnabled] = useState(initial.emailEnabled);
  const [categories, setCategories] = useState(initial.categories);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function save() {
    setBusy(true); setStatus("");
    const result = await updateNotificationPreferencesAction({ inAppEnabled, emailEnabled, categories });
    setBusy(false);
    setStatus(result.success ? text("Preferences saved.", "تم حفظ التفضيلات.") : text("Unable to save preferences.", "تعذر حفظ التفضيلات."));
  }
  return <section className="rounded-3xl border bg-white p-6 shadow-sm dark:bg-slate-900 sm:p-8">
    <div className="mb-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Bell className="h-5 w-5 text-brand-600" />{text("Notification preferences", "تفضيلات الإشعارات")}</h2><p className="mt-1 text-xs text-slate-500">{text("Security and account emails remain enabled when required; these settings control supported workspace notifications.", "تبقى رسائل الأمان والحساب الضرورية مفعلة؛ هذه الإعدادات تتحكم بإشعارات العمل المدعومة.")}</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold"><input type="checkbox" checked={inAppEnabled} onChange={(event) => setInAppEnabled(event.target.checked)} /><Bell className="h-4 w-4 text-brand-600" />{text("In-app notifications", "الإشعارات داخل النظام")}</label>
      <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold"><input type="checkbox" checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} /><Mail className="h-4 w-4 text-brand-600" />{text("Email notifications", "إشعارات البريد الإلكتروني")}</label>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {Object.entries(labels).map(([key, names]) => <label key={key} className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={categories[key] !== false} onChange={(event) => setCategories((current) => ({ ...current, [key]: event.target.checked }))} />{names[ar ? 1 : 0]}</label>)}
    </div>
    <div className="mt-5 flex items-center gap-3 border-t pt-4"><button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{busy ? text("Saving…", "جارٍ الحفظ…") : text("Save preferences", "حفظ التفضيلات")}</button>{status && <span role="status" className="text-sm text-emerald-600">{status}</span>}</div>
  </section>;
}
