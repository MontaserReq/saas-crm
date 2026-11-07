"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Plus, Save, ShieldCheck, Sparkles, Trash2, Power } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { discoverAiProviderModelsAction, saveAiResearchSettingsAction, testAiProviderAction } from "@/server/actions/platform";
import type { AiResearchProvider } from "@/lib/ai/researchSettings";

type ProviderView = {
  id: string;
  name: string;
  kind: AiResearchProvider;
  baseUrl: string;
  model: string;
  organizationRef?: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  temperature?: number;
  responsePath?: string;
  capabilities?: string[];
  customHeaderNames?: string[];
  inputCostPerMillionUsd?: number | null;
  outputCostPerMillionUsd?: number | null;
  connectionStatus?: "UNKNOWN" | "CONNECTED" | "ERROR";
  lastTestedAt?: string | null;
  lastError?: string | null;
  lastLatencyMs?: number | null;
  configured: boolean;
  enabled: boolean;
};

type Settings = {
  status: "OFF" | "BETA" | "ON";
  activeProviderId: string | null;
  featureProviderIds: Record<string, string>;
  fallbackProviderIds: string[];
  providers: ProviderView[];
};

type Usage = {
  totalRequests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
  averageDurationMs: number | null;
  providers: Array<{ providerId: string; requests: number; totalTokens: number; estimatedCostUsd: number | null }>;
};

type DraftProvider = ProviderView & { apiKey: string; clearApiKey: boolean; customHeadersJson: string; clearCustomHeaders: boolean };

const providerPresets = {
  openrouter: { name: "OpenRouter", kind: "openai-compatible" as const, baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
  openai: { name: "OpenAI", kind: "openai-responses" as const, baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  anthropic: { name: "Anthropic Claude", kind: "anthropic" as const, baseUrl: "https://api.anthropic.com", model: "claude-3-5-haiku-latest" },
  gemini: { name: "Google Gemini", kind: "gemini" as const, baseUrl: "", model: "gemini-2.0-flash" },
  groq: { name: "Groq", kind: "groq" as const, baseUrl: "", model: "llama-3.3-70b-versatile" },
  deepseek: { name: "DeepSeek", kind: "openai-compatible" as const, baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  mistral: { name: "Mistral", kind: "openai-compatible" as const, baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest" },
} as const;

function draftFromSettings(settings: Settings): DraftProvider[] {
  return settings.providers.map((provider) => ({ ...provider, apiKey: "", clearApiKey: false, customHeadersJson: "", clearCustomHeaders: false }));
}
export function AiResearchSettingsView({ settings, usage }: { settings: Settings; usage: Usage }) {
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const [status, setStatus] = useState(settings.status);
  const [activeProviderId, setActiveProviderId] = useState(settings.activeProviderId || settings.providers[0]?.id || "");
  const [featureProviderIds, setFeatureProviderIds] = useState(settings.featureProviderIds || {});
  const [fallbackProviderIds, setFallbackProviderIds] = useState(settings.fallbackProviderIds || []);
  const [providers, setProviders] = useState<DraftProvider[]>(() => draftFromSettings(settings));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);
  const [modelOptions, setModelOptions] = useState<Record<string, string[]>>({});
  const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

  const update = (id: string, patch: Partial<DraftProvider>) => setProviders((current) => current.map((provider) => provider.id === id ? { ...provider, ...patch } : provider));
  const applyPreset = (id: string, presetId: string) => { const preset = providerPresets[presetId as keyof typeof providerPresets]; if (preset) update(id, preset); };
  const setEnabled = (id: string, enabled: boolean) => {
    update(id, { enabled });
    if (!enabled && activeProviderId === id) {
      const next = providers.find((provider) => provider.id !== id && provider.enabled);
      if (next) setActiveProviderId(next.id);
    }
  };

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
      customHeadersJson: "",
      clearCustomHeaders: false,
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
      featureProviderIds,
      fallbackProviderIds,
      providers: providers.map(({ id, name, kind, baseUrl, model, organizationRef, timeoutMs, maxOutputTokens, temperature, responsePath, capabilities, customHeadersJson, clearCustomHeaders, inputCostPerMillionUsd, outputCostPerMillionUsd, apiKey, clearApiKey, enabled }) => ({ id, name, kind, baseUrl, model, organizationRef, timeoutMs, maxOutputTokens, temperature, responsePath, capabilities, customHeadersJson, clearCustomHeaders, inputCostPerMillionUsd: inputCostPerMillionUsd ?? null, outputCostPerMillionUsd: outputCostPerMillionUsd ?? null, apiKey, clearApiKey, enabled })),
    });
    if (result.success) {
      const next = result.settings as Settings;
      setStatus(next.status);
      setActiveProviderId(next.activeProviderId || next.providers[0]?.id || "");
      setFeatureProviderIds(next.featureProviderIds || {});
      setFallbackProviderIds(next.fallbackProviderIds || []);
      setProviders(draftFromSettings(next));
      setFeedback({ ok: true, message: ar ? "تم حفظ مزودي الذكاء الاصطناعي." : "AI providers saved." });
    } else {
      setFeedback({ ok: false, message: errorMessage(result.error, ar ? "تعذر حفظ الإعدادات." : "Unable to save settings.") });
    }
    setBusy(false);
  }

  async function testProvider(id: string) {
    setTestingId(id);
    const result = await testAiProviderAction(id);
    setProviders((current) => current.map((provider) => provider.id === id ? { ...provider, connectionStatus: result.success ? "CONNECTED" : "ERROR", lastTestedAt: result.lastTestedAt || new Date().toISOString(), lastLatencyMs: ("durationMs" in result ? result.durationMs : result.lastLatencyMs) ?? null, lastError: result.success ? null : result.error } : provider));
    setFeedback(result.success ? { ok: true, message: ar ? `الاتصال ناجح (${result.model}).` : `Connection succeeded (${result.model}).` } : { ok: false, message: errorMessage(result.error, ar ? "فشل اختبار الاتصال." : "Connection test failed.") });
    setTestingId(null);
  }

  async function discoverModels(id: string) {
    setDiscoveringId(id);
    const result = await discoverAiProviderModelsAction(id);
    if (result.success) {
      setModelOptions((current) => ({ ...current, [id]: result.models }));
      setFeedback({ ok: true, message: result.models.length ? (ar ? `تم العثور على ${result.models.length} نموذج.` : `Found ${result.models.length} models.`) : (ar ? "المزود لم يرجع قائمة نماذج." : "The provider returned no model list.") });
    } else {
      setFeedback({ ok: false, message: errorMessage(result.error, ar ? "تعذر جلب النماذج." : "Unable to discover models.") });
    }
    setDiscoveringId(null);
  }

  return (
    <div className="space-y-6 pb-10" dir={ar ? "rtl" : "ltr"}>
      <header className="rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200"><Sparkles className="h-6 w-6" /></span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.24em] text-cyan-300">{ar ? "تحكم مركزي" : "CENTRAL CONTROL"}</p>
            <h1 className="mt-2 text-3xl font-black">{ar ? "مزودو البحث الذكي" : "Smart research providers"}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{ar ? "أضف وعدّل واحذف مزودي AI. البحث الذكي على الويب يعمل عبر Gemini أو Groq مباشرة، بدون إعداد مزود بحث منفصل." : "Create, edit, enable, disable, and delete AI providers. Smart web research runs directly through Gemini or Groq, with no separate search-provider setup."}</p>
          </div>
        </div>
      </header>

      {feedback && <p role={feedback.ok ? "status" : "alert"} className={`rounded-xl p-4 text-sm ${feedback.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>{feedback.message}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">{ar ? "الاستخدام خلال آخر 30 يومًا" : "Usage — last 30 days"}</h2><p className="mt-1 text-sm text-slate-500">{ar ? "التكلفة تقديرية وتبقى غير معروفة إذا لم تضبط أسعار النموذج." : "Costs are estimates and remain unknown when model pricing is not configured."}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold dark:bg-slate-800">{usage.totalRequests} requests</span></div><div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs text-slate-500">Tokens</p><p className="mt-1 text-lg font-black">{usage.totalTokens.toLocaleString()}</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs text-slate-500">Input / output</p><p className="mt-1 text-lg font-black">{usage.inputTokens.toLocaleString()} / {usage.outputTokens.toLocaleString()}</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs text-slate-500">Estimated cost</p><p className="mt-1 text-lg font-black">{usage.estimatedCostUsd == null ? "Unknown" : `$${usage.estimatedCostUsd.toFixed(6)}`}</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs text-slate-500">Avg duration</p><p className="mt-1 text-lg font-black">{usage.averageDurationMs == null ? "—" : `${Math.round(usage.averageDurationMs)} ms`}</p></div></div>{usage.providers.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{usage.providers.map((provider) => <span key={provider.providerId} className="rounded-full border border-slate-200 px-3 py-1 text-xs dark:border-slate-700">{provider.providerId}: {provider.requests} requests</span>)}</div>}</section>

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
                <label className="flex items-center gap-3 text-sm font-bold"><input type="radio" name="activeProvider" disabled={!provider.enabled} checked={activeProviderId === provider.id} onChange={() => setActiveProviderId(provider.id)} />{ar ? "المزود الأساسي" : "Primary provider"}</label>
                <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={provider.enabled} onChange={(event) => setEnabled(provider.id, event.target.checked)} /><Power className="h-4 w-4" />{provider.enabled ? (ar ? "مفعّل" : "Enabled") : (ar ? "متوقف" : "Disabled")}</label><button type="button" onClick={() => void testProvider(provider.id)} disabled={testingId === provider.id || !provider.enabled || !provider.configured} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-violet-700 disabled:opacity-40">{testingId === provider.id ? (ar ? "اختبار…" : "Testing…") : (ar ? "اختبار" : "Test")}</button><button type="button" onClick={() => removeProvider(provider.id)} disabled={providers.length <= 1} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30" aria-label={ar ? "حذف المزود" : "Delete provider"}><Trash2 className="h-4 w-4" /></button></div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs"><span className={`rounded-full px-2 py-1 font-bold ${provider.connectionStatus === "CONNECTED" ? "bg-emerald-100 text-emerald-700" : provider.connectionStatus === "ERROR" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{provider.connectionStatus === "CONNECTED" ? (ar ? "متصل" : "Connected") : provider.connectionStatus === "ERROR" ? (ar ? "خطأ" : "Error") : (ar ? "غير مختبر" : "Not tested")}</span>{provider.lastTestedAt && <span className="text-slate-500">{ar ? "آخر اختبار" : "Last tested"}: {new Date(provider.lastTestedAt).toLocaleString()}</span>}{provider.lastLatencyMs != null && <span className="text-slate-500">{provider.lastLatencyMs} ms</span>}{provider.lastError && <span className="max-w-full truncate text-rose-600" title={provider.lastError}>{provider.lastError}</span>}</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold">{ar ? "الاسم" : "Name"}<input className={inputClass} value={provider.name} onChange={(event) => update(provider.id, { name: event.target.value })} /></label>
                <label className="text-sm font-semibold">{ar ? "إعداد سريع" : "Preset"}<select className={inputClass} defaultValue="" onChange={(event) => applyPreset(provider.id, event.target.value)}><option value="">{ar ? "إعداد يدوي" : "Manual configuration"}</option>{Object.entries(providerPresets).map(([id, preset]) => <option key={id} value={id}>{preset.name}</option>)}</select></label>
                <label className="text-sm font-semibold">{ar ? "نوع الاتصال" : "Adapter"}<select className={inputClass} value={provider.kind} onChange={(event) => update(provider.id, { kind: event.target.value as AiResearchProvider })}><option value="gemini">Google Gemini</option><option value="groq">Groq</option><option value="openai-compatible">OpenAI-compatible / custom</option><option value="openai-responses">OpenAI Responses API</option><option value="anthropic">Anthropic Messages API</option><option value="custom-http">Custom HTTP adapter</option></select></label>
                <label className="text-sm font-semibold">{ar ? "معرّف المزود" : "Provider ID"}<input className={inputClass} value={provider.id} disabled /></label>
                <label className="text-sm font-semibold">{ar ? "النموذج" : "Model"}<input className={inputClass} value={provider.model} onChange={(event) => update(provider.id, { model: event.target.value })} placeholder="gpt-4o-mini" /><div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" onClick={() => void discoverModels(provider.id)} disabled={discoveringId === provider.id || !provider.enabled || !provider.configured || provider.kind === "custom-http"} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-violet-700 disabled:opacity-40">{discoveringId === provider.id ? (ar ? "جلب…" : "Loading…") : (ar ? "جلب النماذج" : "Discover models")}</button>{(modelOptions[provider.id] || []).map((model) => <button type="button" key={model} onClick={() => update(provider.id, { model })} className={`rounded-full px-2 py-1 text-[11px] ${model === provider.model ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{model}</button>)}</div></label>
                {!['gemini', 'groq'].includes(provider.kind) && <label className="text-sm font-semibold md:col-span-2">Base URL<input className={inputClass} value={provider.baseUrl} onChange={(event) => update(provider.id, { baseUrl: event.target.value })} placeholder="https://api.openai.com/v1" /></label>}
                <label className="text-sm font-semibold">{ar ? "معرّف المؤسسة/المشروع" : "Organization / project ref"}<input className={inputClass} value={provider.organizationRef || ""} onChange={(event) => update(provider.id, { organizationRef: event.target.value })} placeholder="org_xxx or project-id" /></label>
                <label className="text-sm font-semibold">{ar ? "مهلة الاتصال (مللي ثانية)" : "Timeout (ms)"}<input type="number" min={5000} max={120000} className={inputClass} value={provider.timeoutMs ?? 45000} onChange={(event) => update(provider.id, { timeoutMs: Number(event.target.value) || 45000 })} /></label>
                <label className="text-sm font-semibold">{ar ? "الحد الأقصى للتوكنز" : "Max output tokens"}<input type="number" min={1} max={32768} className={inputClass} value={provider.maxOutputTokens ?? 4096} onChange={(event) => update(provider.id, { maxOutputTokens: Number(event.target.value) || 4096 })} /></label>
                <label className="text-sm font-semibold">{ar ? "Temperature" : "Temperature"}<input type="number" min={0} max={2} step={0.1} className={inputClass} value={provider.temperature ?? 0.2} onChange={(event) => update(provider.id, { temperature: Number(event.target.value) || 0.2 })} /></label>
                <label className="text-sm font-semibold">{ar ? "كلفة الإدخال / مليون توكن" : "Input cost / 1M tokens"}<input type="number" min={0} step={0.000001} className={inputClass} value={provider.inputCostPerMillionUsd ?? ""} onChange={(event) => update(provider.id, { inputCostPerMillionUsd: event.target.value === "" ? null : Number(event.target.value) })} placeholder="unknown" /></label>
                <label className="text-sm font-semibold">{ar ? "كلفة الإخراج / مليون توكن" : "Output cost / 1M tokens"}<input type="number" min={0} step={0.000001} className={inputClass} value={provider.outputCostPerMillionUsd ?? ""} onChange={(event) => update(provider.id, { outputCostPerMillionUsd: event.target.value === "" ? null : Number(event.target.value) })} placeholder="unknown" /></label>
                {provider.kind === "custom-http" && <label className="text-sm font-semibold">{ar ? "مسار النص في الاستجابة" : "Response text path"}<input className={inputClass} value={provider.responsePath || ""} onChange={(event) => update(provider.id, { responsePath: event.target.value })} placeholder="choices.0.message.content" /><span className="mt-1 block text-xs font-normal text-slate-500">{ar ? "اتركه فارغًا للاستجابات الشائعة مثل output_text أو choices.0.message.content." : "Optional dot path for the returned JSON text, e.g. choices.0.message.content."}</span></label>}
                <div className="md:col-span-2"><p className="text-sm font-semibold">{ar ? "قدرات المزود (اختياري — اتركها فارغة إذا غير معروفة)" : "Provider capabilities (optional — leave empty if unknown)"}</p><div className="mt-2 flex flex-wrap gap-2">{["text", "streaming", "structured-json", "tools", "vision", "embeddings", "reasoning"].map((capability) => <label key={capability} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700"><input type="checkbox" checked={(provider.capabilities || []).includes(capability)} onChange={(event) => update(provider.id, { capabilities: event.target.checked ? [...new Set([...(provider.capabilities || []), capability])] : (provider.capabilities || []).filter((item) => item !== capability) })} />{capability}</label>)}</div></div>
                <div className="md:col-span-2"><label className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-violet-600" />API key</label><input className={inputClass} type="password" autoComplete="new-password" value={provider.apiKey} onChange={(event) => update(provider.id, { apiKey: event.target.value, clearApiKey: false })} placeholder={provider.configured ? "••••••••  configured" : "Paste API key"} /><div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500"><span className="inline-flex items-center gap-1">{provider.configured ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{ar ? "مهيأ" : "Configured"}</> : (ar ? "غير مهيأ" : "Not configured")}</span>{provider.configured && <label className="text-rose-600"><input type="checkbox" checked={provider.clearApiKey} onChange={(event) => update(provider.id, { clearApiKey: event.target.checked, apiKey: "" })} /> {ar ? "حذف المفتاح الحالي" : "Clear current key"}</label>}</div></div>
                <div className="md:col-span-2"><label className="text-sm font-semibold">{ar ? "Custom headers (JSON اختياري)" : "Custom headers (optional JSON)"}</label><textarea className={inputClass} rows={2} value={provider.customHeadersJson} onChange={(event) => update(provider.id, { customHeadersJson: event.target.value, clearCustomHeaders: false })} placeholder={provider.customHeaderNames?.length ? `Configured: ${provider.customHeaderNames.join(", ")} — paste JSON to replace` : '{"X-Project":"value"}'} /><div className="mt-2 flex items-center gap-3 text-xs text-slate-500">{provider.customHeaderNames?.length ? <span>{ar ? `${provider.customHeaderNames.length} headers محفوظة ومشفرة` : `${provider.customHeaderNames.length} encrypted headers configured`}</span> : null}{provider.customHeaderNames?.length ? <label className="text-rose-600"><input type="checkbox" checked={provider.clearCustomHeaders} onChange={(event) => update(provider.id, { clearCustomHeaders: event.target.checked, customHeadersJson: "" })} /> {ar ? "حذف headers" : "Clear headers"}</label> : null}</div></div>
              </div>
              {provider.kind === "openai-compatible" && <p className="mt-3 text-xs text-slate-500">{ar ? "يجب أن يدعم المزود POST /chat/completions بصيغة OpenAI." : "The provider must support the OpenAI chat-completions request format."}</p>}
              {provider.kind === "anthropic" && <p className="mt-3 text-xs text-slate-500">{ar ? "يستخدم /v1/messages مع x-api-key." : "Uses the native /v1/messages protocol with x-api-key."}</p>}
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"><h2 className="font-bold">{ar ? "التوجيه وFallback" : "Routing and fallback"}</h2><p className="mt-1 text-sm text-slate-500">{ar ? "حدد مزوداً مختلفاً لكل استخدام، ورتب المزودين الاحتياطيين عند فشل المزود الأساسي." : "Choose feature-level providers and the ordered fallback providers used after retryable failures."}</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">{ar ? "اكتشاف العملاء" : "Smart Lead Discovery"}<select className={inputClass} value={featureProviderIds["smart-lead-discovery"] || ""} onChange={(event) => setFeatureProviderIds((current) => ({ ...current, "smart-lead-discovery": event.target.value }))}><option value="">{ar ? "المزود الأساسي" : "Global default"}</option>{providers.map((provider) => <option key={provider.id} value={provider.id} disabled={!provider.enabled}>{provider.name}</option>)}</select></label><label className="text-sm font-semibold">{ar ? "المساعد الذكي" : "AI Assistant"}<select className={inputClass} value={featureProviderIds.assistant || ""} onChange={(event) => setFeatureProviderIds((current) => ({ ...current, assistant: event.target.value }))}><option value="">{ar ? "المزود الأساسي" : "Global default"}</option>{providers.map((provider) => <option key={provider.id} value={provider.id} disabled={!provider.enabled}>{provider.name}</option>)}</select></label></div><div className="mt-4"><p className="text-sm font-semibold">{ar ? "المزودون الاحتياطيون بالترتيب" : "Ordered fallback providers"}</p><div className="mt-2 flex flex-wrap gap-3">{providers.map((provider) => <label key={provider.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700"><input type="checkbox" checked={fallbackProviderIds.includes(provider.id)} disabled={!provider.enabled} onChange={(event) => setFallbackProviderIds((current) => event.target.checked ? [...current, provider.id] : current.filter((id) => id !== provider.id))} />{provider.name}</label>)}</div></div></section>

        <div className="flex justify-end"><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 disabled:opacity-50"><Save className="h-4 w-4" />{busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ التغييرات" : "Save changes")}</button></div>
      </form>
    </div>
  );
}
