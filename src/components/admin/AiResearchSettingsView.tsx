"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Save, ShieldCheck, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { saveAiResearchSettingsAction } from "@/server/actions/platform";
import type { AiResearchProvider, AiResearchStatus } from "@/lib/ai/researchSettings";

type Settings = {
  status: AiResearchStatus;
  provider: AiResearchProvider;
  geminiModel: string;
  groqModel: string;
  geminiConfigured: boolean;
  groqConfigured: boolean;
};

export function AiResearchSettingsView({ settings }: { settings: Settings }) {
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const [values, setValues] = useState({
    status: settings.status,
    provider: settings.provider,
    geminiModel: settings.geminiModel,
    groqModel: settings.groqModel,
    geminiApiKey: "",
    groqApiKey: "",
    clearGeminiApiKey: false,
    clearGroqApiKey: false,
  });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const set = (key: keyof typeof values, value: string | boolean) => setValues((current) => ({ ...current, [key]: value }));
  const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    const result = await saveAiResearchSettingsAction(values);
    if (result.success) {
      setValues((current) => ({ ...current, geminiApiKey: "", groqApiKey: "", clearGeminiApiKey: false, clearGroqApiKey: false }));
      setFeedback({ ok: true, message: ar ? "تم حفظ إعدادات البحث الذكي." : "Smart research settings saved." });
    } else {
      setFeedback({ ok: false, message: errorMessage(result.error, ar ? "تعذر حفظ الإعدادات." : "Unable to save settings.") });
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6 pb-10" dir={ar ? "rtl" : "ltr"}>
      <header className="rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
            <Sparkles className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.24em] text-cyan-300">{ar ? "تحكم مركزي" : "CENTRAL CONTROL"}</p>
            <h1 className="mt-2 text-3xl font-black">{ar ? "إعدادات البحث الذكي" : "Smart research settings"}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {ar ? "أدخل مفاتيح مزود الذكاء الاصطناعي وحدد حالة الميزة لكل شركات المنصة." : "Configure the AI provider keys and control the feature state for every workspace."}
            </p>
          </div>
        </div>
      </header>

      {feedback && <p role={feedback.ok ? "status" : "alert"} className={`rounded-xl p-4 text-sm ${feedback.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>{feedback.message}</p>}

      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 text-violet-600" />
            <div>
              <h2 className="font-bold">{ar ? "حالة الميزة" : "Feature state"}</h2>
              <p className="mt-1 text-sm text-slate-500">{ar ? "OFF يمنع التشغيل، BETA يفتحها كتجربة، ON يفتحها رسميًا." : "OFF blocks execution, BETA enables a controlled beta, and ON enables the released feature."}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              {ar ? "الحالة" : "Status"}
              <select className={inputClass} value={values.status} onChange={(event) => set("status", event.target.value)}>
                <option value="OFF">OFF — {ar ? "متوقفة" : "Disabled"}</option>
                <option value="BETA">BETA — {ar ? "نسخة تجريبية" : "Beta"}</option>
                <option value="ON">ON — {ar ? "مفعّلة" : "Enabled"}</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              {ar ? "المزود الأساسي" : "Primary provider"}
              <select className={inputClass} value={values.provider} onChange={(event) => set("provider", event.target.value)}>
                <option value="gemini">Gemini</option>
                <option value="groq">Groq</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <KeyRound className="mt-1 h-5 w-5 text-violet-600" />
            <div>
              <h2 className="font-bold">{ar ? "مفاتيح API" : "API keys"}</h2>
              <p className="mt-1 text-sm text-slate-500">{ar ? "المفاتيح تحفظ مشفرة ولا تظهر مرة أخرى. اترك الحقل فارغًا للإبقاء على المفتاح الحالي." : "Keys are encrypted and never shown again. Leave a field empty to keep its current key."}</p>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label className="text-sm font-semibold">Gemini API key</label>
              <input className={inputClass} type="password" autoComplete="new-password" value={values.geminiApiKey} onChange={(event) => set("geminiApiKey", event.target.value)} placeholder={settings.geminiConfigured ? "••••••••  configured" : "Paste Gemini key"} />
              <label className="mt-3 flex items-center gap-2 text-xs text-rose-600"><input type="checkbox" checked={values.clearGeminiApiKey} onChange={(event) => set("clearGeminiApiKey", event.target.checked)} />{ar ? "حذف المفتاح الحالي" : "Clear current key"}</label>
              <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">{settings.geminiConfigured ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{ar ? "مهيأ" : "Configured"}</> : (ar ? "غير مهيأ" : "Not configured")}</p>
            </div>
            <div>
              <label className="text-sm font-semibold">Groq API key</label>
              <input className={inputClass} type="password" autoComplete="new-password" value={values.groqApiKey} onChange={(event) => set("groqApiKey", event.target.value)} placeholder={settings.groqConfigured ? "••••••••  configured" : "Paste Groq key"} />
              <label className="mt-3 flex items-center gap-2 text-xs text-rose-600"><input type="checkbox" checked={values.clearGroqApiKey} onChange={(event) => set("clearGroqApiKey", event.target.checked)} />{ar ? "حذف المفتاح الحالي" : "Clear current key"}</label>
              <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">{settings.groqConfigured ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{ar ? "مهيأ" : "Configured"}</> : (ar ? "غير مهيأ" : "Not configured")}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <h2 className="font-bold">{ar ? "النماذج" : "Models"}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Gemini model<input className={inputClass} value={values.geminiModel} onChange={(event) => set("geminiModel", event.target.value)} /></label>
            <label className="text-sm font-semibold">Groq model<input className={inputClass} value={values.groqModel} onChange={(event) => set("groqModel", event.target.value)} /></label>
          </div>
        </section>

        <div className="flex justify-end">
          <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 disabled:opacity-50">
            <Save className="h-4 w-4" />{busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ الإعدادات" : "Save settings")}
          </button>
        </div>
      </form>
    </div>
  );
}
