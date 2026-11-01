"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Plus, Save, ShieldCheck, Sparkles, Trash2, Power } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { saveAiResearchSettingsAction } from "@/server/actions/platform";
import type { AiResearchProvider } from "@/lib/ai/researchSettings";

type ProviderView = {
  id: string;
  name: string;
  kind: AiResearchProvider;
  baseUrl: string;
  model: string;
  configured: boolean;
  enabled: boolean;
};

type Settings = {
  status: "OFF" | "BETA" | "ON";
  activeProviderId: string | null;
  providers: ProviderView[];
};

type DraftProvider = ProviderView & { apiKey: string; clearApiKey: boolean };

const kindLabel: Record<AiResearchProvider, string> = {
  gemini: "Google Gemini",
  groq: "Groq",
  "openai-compatible": "OpenAI-compatible / custom",
};

function draftFromSettings(settings: Settings): DraftProvider[] {
  return settings.providers.map((provider) => ({ ...provider, apiKey: "", clearApiKey: false }));
}

export function AiResearchSettingsView({ settings }: { settings: Settings }) {
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const [status, setStatus] = useState(settings.status);
  const [activeProviderId, setActiveProviderId] = useState(settings.activeProviderId || settings.providers[0]?.id || "");
  const [providers, setProviders] = useState<DraftProvider[]>(() => draftFromSettings(settings));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

  const update = (id: string, patch: Partial<DraftProvider>) => setProviders((current) => current.map((provider) => provider.id === id ? { ...provider, ...patch } : provider));

  function addProvider() {
    const id = `provider-${Date.now()}`;
    setProviders((current) => [...current, {
      id,
      name: ar ? "مزود جديد" : "New provider",
      kind: "openai-compatible",
      baseUrl: "",
      model: "",
      configured: false,
      enabled: true,
      apiKey: "",
      clearApiKey: false,
    }]);
    setActiveProviderId(id);
  }

  function removeProvider(id: string) {
    setProviders((current) => current.filter((provider) => provider.id !== id));
    if (activeProviderId === id) setActiveProviderId(providers.find((provider) => provider.id !== id)?.id || "");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!providers.length) {
      setFeedback({ ok: false, message: ar ? "أضف مزوداً واحداً على الأقل." : "Add at least one provider." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    const result = await saveAiResearchSettingsAction({
      status,
      activeProviderId,
      providers: providers.map(({ id, name, kind, baseUrl, model, apiKey, clearApiKey, enabled }) => ({ id, name, kind, baseUrl, model, apiKey, clearApiKey, enabled })),
    });
    if (result.success) {
      const next = result.settings as Settings;
      setStatus(next.status);
      setActiveProviderId(next.activeProviderId || next.providers[0]?.id || "");
      setProviders(draftFromSettings(next));
      setFeedback({ ok: true, message: ar ? "تم حفظ مزودي الذكاء الاصطناعي." : "AI providers saved." });
    } else {
      setFeedback({ ok: false, message: errorMessage(result.error, ar ? "تعذر حفظ الإعدادات." : "Unable to save settings.") });
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6 pb-10" dir={ar ? "rtl" : "ltr"}>
      <header className="rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200"><Sparkles className="h-6 w-6" /></span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.24em] text-cyan-300">{ar ? "تحكم مركزي" : "CENTRAL CONTROL"}</p>
            <h1 className="mt-2 text-3xl font-black">{ar ? "مزودو البحث الذكي" : "Smart research providers"}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{ar ? "أضف وعدّل واحذف أي مزود AI متوافق مع OpenAI API، أو استخدم Gemini وGroq كموفرين جاهزين." : "Create, edit, enable, disable, and delete AI providers. Custom providers use the OpenAI-compatible chat-completions API."}</p>
          </div>
        </div>
      </header>

      {feedback && <p role={feedback.ok ? "status" : "alert"} className={`rounded-xl p-4 text-sm ${feedback.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>{feedback.message}</p>}

      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-5 flex items-start gap-3"><ShieldCheck className="mt-1 h-5 w-5 text-violet-600" /><div><h2 className="font-bold">{ar ? "حالة الميزة" : "Feature state"}</h2><p className="mt-1 text-sm text-slate-500">{ar ? "OFF يمنع التشغيل، BETA يفتحها كتجربة، وON يفتحها رسميًا." : "OFF blocks execution, BETA enables a beta, and ON enables the released feature."}</p></div></div>
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as Settings["status"])}>
            <option value="OFF">OFF — {ar ? "متوقفة" : "Disabled"}</option>
            <option value="BETA">BETA — {ar ? "نسخة تجريبية" : "Beta"}</option>
            <option value="ON">ON — {ar ? "مفعّلة" : "Enabled"}</option>
          </select>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">{ar ? "المزودون" : "Providers"}</h2><p className="mt-1 text-sm text-slate-500">{ar ? "اختر المزود الأساسي، ويمكنك إطفاء أي مزود بدون حذفه." : "Choose the primary provider and disable any provider without deleting it."}</p></div><button type="button" onClick={addProvider} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" />{ar ? "إضافة مزود" : "Add provider"}</button></div>

          {providers.map((provider) => (
            <article key={provider.id} className={`rounded-2xl border p-5 ${provider.enabled ? "border-slate-200 dark:border-slate-700" : "border-dashed border-slate-300 opacity-70 dark:border-slate-700"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <label className="flex items-center gap-3 text-sm font-bold"><input type="radio" name="activeProvider" checked={activeProviderId === provider.id} onChange={() => setActiveProviderId(provider.id)} />{ar ? "المزود الأساسي" : "Primary provider"}</label>
                <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={provider.enabled} onChange={(event) => update(provider.id, { enabled: event.target.checked })} /><Power className="h-4 w-4" />{provider.enabled ? (ar ? "مفعّل" : "Enabled") : (ar ? "متوقف" : "Disabled")}</label><button type="button" onClick={() => removeProvider(provider.id)} disabled={providers.length <= 1} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30" aria-label={ar ? "حذف المزود" : "Delete provider"}><Trash2 className="h-4 w-4" /></button></div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold">{ar ? "الاسم" : "Name"}<input className={inputClass} value={provider.name} onChange={(event) => update(provider.id, { name: event.target.value })} /></label>
                <label className="text-sm font-semibold">{ar ? "نوع الاتصال" : "Adapter"}<select className={inputClass} value={provider.kind} onChange={(event) => update(provider.id, { kind: event.target.value as AiResearchProvider })}><option value="gemini">Google Gemini</option><option value="groq">Groq</option><option value="openai-compatible">OpenAI-compatible / custom</option></select></label>
                <label className="text-sm font-semibold">{ar ? "معرّف المزود" : "Provider ID"}<input className={inputClass} value={provider.id} disabled /></label>
                <label className="text-sm font-semibold">{ar ? "النموذج" : "Model"}<input className={inputClass} value={provider.model} onChange={(event) => update(provider.id, { model: event.target.value })} placeholder="gpt-4o-mini" /></label>
                {provider.kind === "openai-compatible" && <label className="text-sm font-semibold md:col-span-2">Base URL<input className={inputClass} value={provider.baseUrl} onChange={(event) => update(provider.id, { baseUrl: event.target.value })} placeholder="https://api.openai.com/v1" /></label>}
                <div className="md:col-span-2"><label className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-violet-600" />API key</label><input className={inputClass} type="password" autoComplete="new-password" value={provider.apiKey} onChange={(event) => update(provider.id, { apiKey: event.target.value, clearApiKey: false })} placeholder={provider.configured ? "••••••••  configured" : "Paste API key"} /><div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500"><span className="inline-flex items-center gap-1">{provider.configured ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{ar ? "مهيأ" : "Configured"}</> : (ar ? "غير مهيأ" : "Not configured")}</span>{provider.configured && <label className="text-rose-600"><input type="checkbox" checked={provider.clearApiKey} onChange={(event) => update(provider.id, { clearApiKey: event.target.checked, apiKey: "" })} /> {ar ? "حذف المفتاح الحالي" : "Clear current key"}</label>}</div></div>
              </div>
              {provider.kind === "openai-compatible" && <p className="mt-3 text-xs text-slate-500">{ar ? "يجب أن يدعم المزود POST /chat/completions بصيغة OpenAI." : "The provider must support the OpenAI chat-completions request format."}</p>}
            </article>
          ))}
        </section>

        <div className="flex justify-end"><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 disabled:opacity-50"><Save className="h-4 w-4" />{busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ التغييرات" : "Save changes")}</button></div>
      </form>
    </div>
  );
}
